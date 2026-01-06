import { injectable } from "tsyringe";
import amqp from "amqplib";
import { Server as SocketIOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { runWithContextAsync } from "@echo/telemetry";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import { RabbitMQEvent, ChannelDeletedEvent } from "../types/rabbitmq.types";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * RabbitMQ Consumer for BFF Service
 *
 * Consumes events from the shared echo.events exchange and broadcasts them to connected
 * Socket.IO clients in real-time.
 *
 * Exchange consumed:
 * - 'echo.events' exchange: All service events (message.created, workspace.invite.created, etc.)
 *
 * Features:
 * - Topic routing for message events
 * - Automatic reconnection on connection failure
 * - Broadcasts events to Socket.IO rooms based on workspaceId/channelId
 * - Message acknowledgment for reliable delivery
 * - Graceful shutdown
 */
@injectable()
export class RabbitMQConsumer implements IRabbitMQConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queueName: string;
  private readonly criticalQueueName: string;
  private readonly waitingRoomQueueName: string;
  private readonly parkingLotQueueName: string;
  private readonly exchange = config.rabbitmq.exchange;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly maxRetries = 3;
  private readonly waitingRoomTTL = 30000; // 30 seconds

  constructor(private readonly io: SocketIOServer) {
    // All BFF instances share the same queue (work queue pattern)
    // RabbitMQ distributes messages among consumers, Socket.IO Redis adapter
    // ensures events reach all connected clients across all BFF instances
    this.queueName = `bff_service_queue`;
    // Critical queue for events that need retry guarantees (e.g., channel.deleted)
    this.criticalQueueName = `bff_service_critical_queue`;
    this.waitingRoomQueueName = `${this.criticalQueueName}_waiting_room`;
    this.parkingLotQueueName = `${this.criticalQueueName}_parking_lot`;
  }

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

      // ===== NON-CRITICAL QUEUE (ephemeral) =====
      // For events like message.created that can be missed without critical impact
      await ch.assertQueue(this.queueName, {
        exclusive: false, // Shared among all BFF instances
        durable: false, // Don't need persistence since BFF processes in real-time
        autoDelete: true, // Delete queue when all consumers disconnect
      });

      // ===== CRITICAL QUEUE (durable with retry pattern) =====
      // For events like channel.deleted that must be processed reliably

      // Declare parking lot queue for permanently failed messages (after 3 retries)
      await ch.assertQueue(this.parkingLotQueueName, {
        exclusive: false,
        durable: true,
        autoDelete: false,
      });

      // Declare waiting room queue with TTL and dead letter back to critical queue
      await ch.assertQueue(this.waitingRoomQueueName, {
        exclusive: false,
        durable: true,
        autoDelete: false,
        arguments: {
          "x-message-ttl": this.waitingRoomTTL,
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": this.criticalQueueName,
        },
      });

      // Declare critical queue with DLX to waiting room
      await ch.assertQueue(this.criticalQueueName, {
        exclusive: false,
        durable: true,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": this.waitingRoomQueueName,
        },
      });

      // Bind non-critical queue to echo.events exchange with routing keys
      await ch.bindQueue(this.queueName, this.exchange, "message.created");
      await ch.bindQueue(
        this.queueName,
        this.exchange,
        "workspace.member.joined"
      );
      await ch.bindQueue(
        this.queueName,
        this.exchange,
        "workspace.member.left"
      );
      await ch.bindQueue(
        this.queueName,
        this.exchange,
        "channel.member.joined"
      );
      await ch.bindQueue(this.queueName, this.exchange, "channel.member.left");
      await ch.bindQueue(this.queueName, this.exchange, "channel.created");

      // Bind critical queue to channel.deleted (needs retry guarantees)
      await ch.bindQueue(
        this.criticalQueueName,
        this.exchange,
        "channel.deleted"
      );

      // Start consuming from non-critical queue
      await ch.consume(this.queueName, (msg) => this.handleMessage(msg), {
        noAck: false, // Manual acknowledgment for reliability
      });

      // Start consuming from critical queue (with retry pattern)
      await ch.consume(
        this.criticalQueueName,
        (msg) => this.handleCriticalMessage(msg),
        {
          noAck: false,
        }
      );

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      logger.info("✅ RabbitMQ consumer initialized", {
        queue: this.queueName,
        criticalQueue: this.criticalQueueName,
        waitingRoom: this.waitingRoomQueueName,
        parkingLot: this.parkingLotQueueName,
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
   * Handle incoming message from RabbitMQ
   */
  private async handleMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) {
      return;
    }

    try {
      // Parse event
      const event: RabbitMQEvent = JSON.parse(msg.content.toString());

      // Extract correlationId and userId from event metadata
      const metadata = (event as any).metadata;
      const correlationId = metadata?.correlationId || uuidv4();
      const userId = metadata?.userId;

      // Run message processing in OTel context
      await runWithContextAsync({ userId, timestamp: new Date() }, async () => {
        logger.info("Received RabbitMQ event", {
          type: event.type,
          eventType: (event as any).eventType,
          routingKey: msg.fields.routingKey,
          correlationId,
          userId,
          rawEventKeys: Object.keys(event),
        });

        // Route event to appropriate handler
        await this.routeEvent(event);

        // Acknowledge message
        if (this.channel) {
          this.channel.ack(msg);
        }
      });
    } catch (error) {
      logger.error("Error processing RabbitMQ message", {
        error,
        routingKey: msg.fields.routingKey,
      });

      // Reject message (don't requeue to avoid infinite loops)
      if (this.channel) {
        this.channel.nack(msg, false, false);
      }
    }
  }

  /**
   * Handle incoming message from critical queue (with retry pattern)
   * Uses Waiting Room and Parking Lot pattern for failed messages
   */
  private async handleCriticalMessage(
    msg: amqp.ConsumeMessage | null
  ): Promise<void> {
    if (!msg || !this.channel) {
      return;
    }

    let parsedEvent: ChannelDeletedEvent | null = null;

    try {
      // Parse event
      parsedEvent = JSON.parse(msg.content.toString());

      if (!parsedEvent) {
        throw new Error("Failed to parse critical message content");
      }

      const event = parsedEvent;

      // Extract correlationId and userId from event metadata
      const correlationId = event.metadata?.correlationId || uuidv4();
      const userId = event.metadata?.userId;

      // Build context object only with defined values
      const context: { timestamp: Date; userId?: string } = {
        timestamp: new Date(),
      };
      if (userId) {
        context.userId = userId;
      }

      // Run message processing in OTel context
      await runWithContextAsync(context, async () => {
        logger.info("Received critical RabbitMQ event", {
          eventType: event.eventType,
          eventId: event.eventId,
          routingKey: msg.fields.routingKey,
          correlationId,
          userId,
        });

        // Handle channel deleted event
        await this.handleChannelDeleted(event);

        // Acknowledge message
        if (this.channel) {
          this.channel.ack(msg);
        }

        logger.info("Successfully processed critical event", {
          eventType: event.eventType,
          eventId: event.eventId,
          correlationId,
        });
      });
    } catch (error) {
      logger.error("Error processing critical RabbitMQ message", {
        error,
        routingKey: msg.fields.routingKey,
        eventId: parsedEvent?.eventId,
      });

      // Use waiting room and parking lot pattern
      await this.handleFailedCriticalMessage(msg, error);
    }
  }

  /**
   * Handle failed critical message processing with retry logic
   * Uses DLX configuration for automatic routing:
   * - Critical queue DLX → Waiting room (on NACK)
   * - Waiting room DLX → Critical queue (on TTL expiry)
   * - Parking lot for messages that exceed max retries
   */
  private async handleFailedCriticalMessage(
    msg: amqp.ConsumeMessage,
    error: unknown
  ): Promise<void> {
    if (!this.channel) {
      return;
    }

    try {
      // Check x-death header to determine retry count
      const xDeath = msg.properties.headers?.["x-death"] as
        | Array<{ count: number; queue: string; reason: string }>
        | undefined;

      // Count retries based on how many times message came back from waiting room
      let retryCount = 0;
      if (xDeath) {
        const waitingRoomDeath = xDeath.find(
          (d) => d.queue === this.waitingRoomQueueName
        );
        retryCount = waitingRoomDeath?.count || 0;
      }

      logger.info("Critical message failure - checking retry count", {
        retryCount,
        maxRetries: this.maxRetries,
        willRetry: retryCount < this.maxRetries,
        xDeathInfo: xDeath?.map((d) => ({
          queue: d.queue,
          count: d.count,
          reason: d.reason,
        })),
      });

      if (retryCount < this.maxRetries) {
        // NACK the message - it will automatically go to waiting room via DLX
        logger.info(
          "NACK'ing critical message - will be retried via waiting room",
          {
            retryCount,
            nextRetry: retryCount + 1,
            waitingRoomTTL: `${this.waitingRoomTTL}ms`,
          }
        );

        this.channel.nack(msg, false, false);
      } else {
        // Max retries exceeded - send to parking lot
        logger.error(
          "Max retries exceeded for critical message - sending to parking lot",
          {
            retryCount,
            maxRetries: this.maxRetries,
            parkingLot: this.parkingLotQueueName,
            error:
              error instanceof Error
                ? { message: error.message, stack: error.stack }
                : String(error),
          }
        );

        // Add failure information to message headers
        const updatedProperties = {
          ...msg.properties,
          headers: {
            ...msg.properties.headers,
            "x-failure-reason":
              error instanceof Error ? error.message : String(error),
            "x-failure-timestamp": new Date().toISOString(),
            "x-original-queue": this.criticalQueueName,
            "x-total-retries": retryCount,
          },
        };

        // Send to parking lot for manual inspection
        this.channel.sendToQueue(
          this.parkingLotQueueName,
          msg.content,
          updatedProperties
        );

        // ACK the original message since we've handled it
        this.channel.ack(msg);
      }
    } catch (retryError) {
      logger.error(
        "Error handling failed critical message - nacking without requeue",
        {
          retryError,
          originalError: error,
        }
      );

      this.channel.nack(msg, false, false);
    }
  }

  /**
   * Route event to appropriate Socket.IO broadcast
   * Handles both 'type' and 'eventType' property names for compatibility
   */
  private async routeEvent(event: RabbitMQEvent): Promise<void> {
    // Support both 'type' and 'eventType' for compatibility
    const eventType = (event as any).type || (event as any).eventType;

    logger.info("Routing event", {
      eventType,
      hasType: !!(event as any).type,
      hasEventType: !!(event as any).eventType,
      eventKeys: Object.keys(event),
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

      // Note: channel.deleted is handled by handleCriticalMessage() via critical queue
      // with retry pattern - not routed here

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
    // Clients should handle this by showing a notification and redirecting to general channel
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
    // This effectively "deletes" the room since rooms are cleaned up when empty
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
