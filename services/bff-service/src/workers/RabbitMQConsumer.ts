import { injectable } from "tsyringe";
import amqp from "amqplib";
import { Server as SocketIOServer } from "socket.io";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import {
  RabbitMQEvent,
  ChannelDeletedEvent,
  WorkspaceDeletedEvent,
} from "../types/rabbitmq.types";
import { config } from "../config/env";
import logger from "../utils/logger";
import { RabbitMQEventConsumer } from "./RabbitMQEventConsumer";
import { RabbitMQEventConsumerNoDLX } from "./RabbitMQEventConsumerNoDLX";

/**
 * RabbitMQ Consumer for BFF Service
 *
 * Orchestrates RabbitMQ connection and manages multiple event consumers.
 * Uses two types of consumers:
 * - RabbitMQEventConsumerNoDLX: For non-critical real-time events (message.created, etc.)
 * - RabbitMQEventConsumer: For critical events with retry pattern (channel.deleted, workspace.deleted)
 *
 * Features:
 * - Automatic reconnection on connection failure
 * - Multiple event consumer management
 * - Work queue pattern for horizontal scaling
 * - Graceful shutdown
 */
@injectable()
export class RabbitMQConsumer implements IRabbitMQConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchange = config.rabbitmq.exchange;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly maxRetries = 3;
  private readonly waitingRoomTTL = 30000; // 30 seconds

  private nonCriticalConsumer: RabbitMQEventConsumerNoDLX<RabbitMQEvent> | null =
    null;
  private channelDeletedConsumer: RabbitMQEventConsumer<ChannelDeletedEvent> | null =
    null;
  private workspaceDeletedConsumer: RabbitMQEventConsumer<WorkspaceDeletedEvent> | null =
    null;

  constructor(private readonly io: SocketIOServer) {}

  /**
   * Initialize RabbitMQ consumer
   */
  async initialize(): Promise<void> {
    if (this.isConnected()) {
      logger.warn("RabbitMQ consumer already connected");
      return;
    }

    try {
      logger.info("🔌 Connecting to RabbitMQ...");

      // Create connection
      const conn = await amqp.connect(config.rabbitmq.url);
      this.connection = conn;

      // Handle connection events
      conn.on("error", (error) => {
        logger.error("RabbitMQ connection error", { error });
        this.handleConnectionClose();
      });

      conn.on("close", () => {
        logger.warn("RabbitMQ connection closed");
        this.handleConnectionClose();
      });

      // Create channel
      const ch = await conn.createChannel();
      this.channel = ch;

      // Set prefetch to control how many messages to process at once
      await ch.prefetch(10);

      // Handle channel events
      ch.on("error", (error) => {
        logger.error("RabbitMQ channel error", { error });
      });

      ch.on("close", () => {
        logger.warn("RabbitMQ channel closed");
      });

      // Declare echo.events exchange (idempotent)
      await ch.assertExchange(this.exchange, "topic", {
        durable: true,
      });

      // Set up event consumers
      await this.setupEventConsumers();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      logger.info("✅ RabbitMQ consumer initialized", {
        exchange: this.exchange,
        maxRetries: this.maxRetries,
        waitingRoomTTL: `${this.waitingRoomTTL}ms`,
      });
    } catch (error) {
      logger.error("Failed to initialize RabbitMQ consumer", { error });
      this.handleConnectionClose();
      throw error;
    }
  }

  /**
   * Set up event consumers for all event types
   */
  private async setupEventConsumers(): Promise<void> {
    if (!this.channel) {
      throw new Error("Channel not initialized");
    }

    // === NON-CRITICAL CONSUMER (ephemeral, no retry) ===
    // For real-time events that can be missed: message.created, member.joined, etc.
    this.nonCriticalConsumer = new RabbitMQEventConsumerNoDLX(
      this.channel,
      this.exchange,
      {
        queueNamePrefix: "bff_service",
        routingKey: [
          "message.created",
          "workspace.member.joined",
          "workspace.member.left",
          "channel.member.joined",
          "channel.member.left",
          "channel.created",
        ],
        durable: false,
        autoDelete: true,
      },
      (event) => this.routeEvent(event)
    );

    // === CRITICAL CONSUMERS (durable, with retry pattern) ===

    // Channel deleted consumer
    this.channelDeletedConsumer = new RabbitMQEventConsumer(
      this.channel,
      this.exchange,
      {
        queueNamePrefix: "bff_service_channel_deleted",
        routingKey: "channel.deleted",
        durable: true,
        autoDelete: false,
        maxRetries: this.maxRetries,
        waitingRoomTTL: this.waitingRoomTTL,
      },
      (event) => this.handleChannelDeleted(event)
    );

    // Workspace deleted consumer
    this.workspaceDeletedConsumer = new RabbitMQEventConsumer(
      this.channel,
      this.exchange,
      {
        queueNamePrefix: "bff_service_workspace_deleted",
        routingKey: "workspace.deleted",
        durable: true,
        autoDelete: false,
        maxRetries: this.maxRetries,
        waitingRoomTTL: this.waitingRoomTTL,
      },
      (event) => this.handleWorkspaceDeleted(event)
    );

    // Setup queues and start consuming
    await this.nonCriticalConsumer.setupQueues();
    await this.nonCriticalConsumer.startConsuming();

    await this.channelDeletedConsumer.setupQueues();
    await this.channelDeletedConsumer.startConsuming();

    await this.workspaceDeletedConsumer.setupQueues();
    await this.workspaceDeletedConsumer.startConsuming();

    // Log queue names for debugging
    const channelQueues = this.channelDeletedConsumer.getQueueNames();
    const workspaceQueues = this.workspaceDeletedConsumer.getQueueNames();

    logger.info("Event consumers initialized", {
      nonCritical: this.nonCriticalConsumer.getMainQueueName(),
      channelDeleted: channelQueues,
      workspaceDeleted: workspaceQueues,
    });
  }

  /**
   * Route event to appropriate Socket.IO broadcast
   */
  private async routeEvent(event: RabbitMQEvent): Promise<void> {
    // Support both 'type' and 'eventType' for compatibility
    const eventType = (event as any).type || (event as any).eventType;

    logger.info("Routing event", {
      eventType,
      hasType: !!(event as any).type,
      hasEventType: !!(event as any).eventType,
    });

    switch (eventType) {
      case "message.created":
        await this.handleMessageCreated(event as any);
        break;

      case "workspace.member.joined":
        await this.handleWorkspaceMemberJoined(event);
        break;

      case "workspace.member.left":
        await this.handleWorkspaceMemberLeft(event);
        break;

      case "channel.member.joined":
        await this.handleChannelMemberJoined(event);
        break;

      case "channel.member.left":
        await this.handleChannelMemberLeft(event);
        break;

      case "channel.created":
        await this.handleChannelCreated(event);
        break;

      default:
        logger.warn("Unknown event type", { type: eventType });
    }
  }

  /**
   * Handle message.created event
   * Broadcast to all clients in the channel room
   */
  private async handleMessageCreated(
    event: RabbitMQEvent & { type: "message.created" }
  ): Promise<void> {
    const { workspaceId, channelId } = event.payload;

    // Broadcast to channel room
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    this.io.to(roomName).emit("message:created", event.payload);

    logger.info("Broadcasted message.created", {
      workspaceId,
      channelId,
      messageId: event.payload.id,
      room: roomName,
    });
  }

  /**
   * Handle workspace.member.joined event
   * Broadcast to all clients in the workspace room
   */
  private async handleWorkspaceMemberJoined(
    event: RabbitMQEvent
  ): Promise<void> {
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, userId, user } = eventData;

    // Broadcast to workspace room
    const roomName = `workspace:${workspaceId}`;

    this.io.to(roomName).emit("workspace:member:joined", {
      workspaceId,
      userId,
      user,
    });

    logger.info("Broadcasted workspace.member.joined", {
      workspaceId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle workspace.member.left event
   * Broadcast to all clients in the workspace room
   */
  private async handleWorkspaceMemberLeft(event: RabbitMQEvent): Promise<void> {
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, userId } = eventData;

    // Broadcast to workspace room
    const roomName = `workspace:${workspaceId}`;

    this.io.to(roomName).emit("workspace:member:left", {
      workspaceId,
      userId,
    });

    logger.info("Broadcasted workspace.member.left", {
      workspaceId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle channel.member.joined event
   * Broadcast to all clients in the channel room
   */
  private async handleChannelMemberJoined(event: RabbitMQEvent): Promise<void> {
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, channelId, userId, user } = eventData;

    // Broadcast to channel room
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    this.io.to(roomName).emit("channel:member:joined", {
      workspaceId,
      channelId,
      userId,
      user,
    });

    logger.info("Broadcasted channel.member.joined", {
      workspaceId,
      channelId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle channel.member.left event
   * Broadcast to all clients in the channel room
   */
  private async handleChannelMemberLeft(event: RabbitMQEvent): Promise<void> {
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, channelId, userId } = eventData;

    // Broadcast to channel room
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    this.io.to(roomName).emit("channel:member:left", {
      workspaceId,
      channelId,
      userId,
    });

    logger.info("Broadcasted channel.member.left", {
      workspaceId,
      channelId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle channel.created event
   * Routes to workspace room for public channels or individual user rooms for private channels
   */
  private async handleChannelCreated(event: RabbitMQEvent): Promise<void> {
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, isPrivate, members } = eventData;

    if (isPrivate) {
      // Private channel: emit only to specific user rooms
      // This ensures only invited members receive the event
      for (const member of members) {
        const userRoom = `user:${member.userId}`;
        this.io.to(userRoom).emit("channel:created", eventData);
      }

      logger.info("Broadcasted private channel.created to user rooms", {
        workspaceId,
        channelId: eventData.channelId,
        memberCount: members.length,
        isPrivate: true,
      });
    } else {
      // Public channel: broadcast to workspace room
      // All workspace members will receive the event
      const roomName = `workspace:${workspaceId}`;
      this.io.to(roomName).emit("channel:created", eventData);

      logger.info("Broadcasted public channel.created to workspace room", {
        workspaceId,
        channelId: eventData.channelId,
        room: roomName,
        memberCount: members.length,
        isPrivate: false,
      });
    }
  }

  /**
   * Handle channel.deleted event
   * Broadcasts deletion notification to all clients in the channel room,
   * then removes all sockets from the room
   */
  private async handleChannelDeleted(
    event: ChannelDeletedEvent
  ): Promise<void> {
    const { channelId, workspaceId, channelName, deletedBy } = event.data;

    // Channel room name
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    // Get all sockets in the room before broadcasting
    const socketsInRoom = await this.io.in(roomName).fetchSockets();
    const socketCount = socketsInRoom.length;

    // Broadcast channel deleted event to all clients in the channel room
    this.io.to(roomName).emit("channel:deleted", {
      channelId,
      workspaceId,
      channelName,
      deletedBy,
    });

    logger.info("Broadcasted channel:deleted event", {
      channelId,
      workspaceId,
      channelName,
      deletedBy,
      room: roomName,
      socketCount,
    });

    // Remove all sockets from the channel room
    for (const socket of socketsInRoom) {
      socket.leave(roomName);
    }

    logger.info("Removed all sockets from deleted channel room", {
      channelId,
      workspaceId,
      room: roomName,
      socketsRemoved: socketCount,
    });
  }

  /**
   * Handle workspace.deleted event
   * Broadcasts deletion notification to all clients in the workspace room,
   * removes all sockets from workspace and channel rooms, then deletes the rooms
   */
  private async handleWorkspaceDeleted(
    event: WorkspaceDeletedEvent
  ): Promise<void> {
    const { workspaceId, workspaceName, deletedBy, channelIds } = event.data;

    // Workspace room name
    const workspaceRoomName = `workspace:${workspaceId}`;

    // Get all sockets in the workspace room before broadcasting
    const socketsInWorkspaceRoom = await this.io
      .in(workspaceRoomName)
      .fetchSockets();
    const workspaceSocketCount = socketsInWorkspaceRoom.length;

    // Broadcast workspace deleted event to all clients in the workspace room
    // Clients should handle this by redirecting to another workspace or workspace selection
    this.io.to(workspaceRoomName).emit("workspace:deleted", {
      workspaceId,
      workspaceName,
      deletedBy,
      channelIds,
    });

    logger.info("Broadcasted workspace:deleted event", {
      workspaceId,
      workspaceName,
      deletedBy,
      room: workspaceRoomName,
      socketCount: workspaceSocketCount,
      channelCount: channelIds.length,
    });

    // Remove all sockets from all channel rooms in this workspace
    let totalChannelSocketsRemoved = 0;
    for (const channelId of channelIds) {
      const channelRoomName = `workspace:${workspaceId}:channel:${channelId}`;
      const socketsInChannelRoom = await this.io
        .in(channelRoomName)
        .fetchSockets();

      for (const socket of socketsInChannelRoom) {
        socket.leave(channelRoomName);
      }

      totalChannelSocketsRemoved += socketsInChannelRoom.length;
    }

    logger.info("Removed all sockets from channel rooms", {
      workspaceId,
      channelCount: channelIds.length,
      socketsRemoved: totalChannelSocketsRemoved,
    });

    // Remove all sockets from the workspace room
    for (const socket of socketsInWorkspaceRoom) {
      socket.leave(workspaceRoomName);
    }

    logger.info("Removed all sockets from deleted workspace room", {
      workspaceId,
      workspaceName,
      room: workspaceRoomName,
      socketsRemoved: workspaceSocketCount,
      totalChannelSocketsRemoved,
    });
  }

  /**
   * Handle connection close and attempt reconnection
   */
  private handleConnectionClose(): void {
    this.connection = null;
    this.channel = null;

    if (this.reconnectTimer) {
      return; // Reconnection already scheduled
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached, giving up", {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.warn(`Attempting to reconnect to RabbitMQ in ${delay}ms`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.initialize();
      } catch (error) {
        logger.error("Reconnection attempt failed", { error });
      }
    }, delay);
  }

  /**
   * Close RabbitMQ connection gracefully
   */
  async close(): Promise<void> {
    try {
      logger.info("Closing RabbitMQ consumer...");

      // Clear reconnect timer if exists
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Close channel
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      // Close connection
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      logger.info("✅ RabbitMQ consumer closed");
    } catch (error) {
      logger.error("Error closing RabbitMQ consumer", { error });
    }
  }

  /**
   * Check if consumer is connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }
}
