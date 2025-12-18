import { injectable } from "tsyringe";
import amqp from "amqplib";
import { Server as SocketIOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { runWithContextAsync } from "@echo/telemetry";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import { RabbitMQEvent } from "../types/rabbitmq.types";
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
  private readonly exchange = config.rabbitmq.exchange;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly io: SocketIOServer) {
    // All BFF instances share the same queue (work queue pattern)
    // RabbitMQ distributes messages among consumers, Socket.IO Redis adapter
    // ensures events reach all connected clients across all BFF instances
    this.queueName = `bff_service_queue`;
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

      // Declare shared work queue for all BFF instances
      await ch.assertQueue(this.queueName, {
        exclusive: false, // Shared among all BFF instances
        durable: false, // Don't need persistence since BFF processes in real-time
        autoDelete: true, // Delete queue when all consumers disconnect
      });

      // Bind queue to echo.events exchange with routing keys
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

      // Start consuming
      await ch.consume(this.queueName, (msg) => this.handleMessage(msg), {
        noAck: false, // Manual acknowledgment for reliability
      });

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      logger.info("✅ RabbitMQ consumer initialized", {
        queue: this.queueName,
        exchange: this.exchange,
        routingKey: "message.created",
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
          routingKey: msg.fields.routingKey,
          correlationId,
          userId,
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
   * Route event to appropriate Socket.IO broadcast
   */
  private async routeEvent(event: RabbitMQEvent): Promise<void> {
    switch (event.type) {
      case "message.created":
        await this.handleMessageCreated(event);
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

      default:
        logger.warn("Unknown event type", { type: (event as any).type });
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
    const { workspaceId, userId, user } = (event as any).payload;

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
    const { workspaceId, userId } = (event as any).payload;

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
    const { workspaceId, channelId, userId, user } = (event as any).payload;

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
    const { workspaceId, channelId, userId } = (event as any).payload;

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
