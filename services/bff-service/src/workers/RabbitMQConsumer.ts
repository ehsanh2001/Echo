import { injectable, inject } from "tsyringe";
import amqp from "amqplib";
import { Server as SocketIOServer } from "socket.io";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import {
  INonCriticalEventHandler,
  IChannelDeletedEventHandler,
  IWorkspaceDeletedEventHandler,
  IPasswordResetEventHandler,
} from "../interfaces/handlers";
import {
  RabbitMQEvent,
  ChannelDeletedEvent,
  WorkspaceDeletedEvent,
  PasswordResetCompletedEvent,
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
 * - Handler injection via DI for better testability
 */
@injectable()
export class RabbitMQConsumer implements IRabbitMQConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private io: SocketIOServer | null = null;
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
  private passwordResetConsumer: RabbitMQEventConsumer<PasswordResetCompletedEvent> | null =
    null;

  constructor(
    @inject("INonCriticalEventHandler")
    private readonly nonCriticalEventHandler: INonCriticalEventHandler,
    @inject("IChannelDeletedEventHandler")
    private readonly channelDeletedEventHandler: IChannelDeletedEventHandler,
    @inject("IWorkspaceDeletedEventHandler")
    private readonly workspaceDeletedEventHandler: IWorkspaceDeletedEventHandler,
    @inject("IPasswordResetEventHandler")
    private readonly passwordResetEventHandler: IPasswordResetEventHandler
  ) {}

  /**
   * Set the Socket.IO server instance
   * Must be called before initialize()
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
    // Pass Socket.IO server to all handlers
    this.nonCriticalEventHandler.setSocketServer(io);
    this.channelDeletedEventHandler.setSocketServer(io);
    this.workspaceDeletedEventHandler.setSocketServer(io);
    this.passwordResetEventHandler.setSocketServer(io);
  }

  /**
   * Initialize RabbitMQ consumer
   */
  async initialize(): Promise<void> {
    if (!this.io) {
      throw new Error("Socket.IO server not set. Call setSocketServer first.");
    }

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
      (event) => this.nonCriticalEventHandler.handleEvent(event)
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
      (event) => this.channelDeletedEventHandler.handleChannelDeleted(event)
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
      (event) => this.workspaceDeletedEventHandler.handleWorkspaceDeleted(event)
    );

    // Password reset consumer - notifies user's active sessions to log out
    this.passwordResetConsumer = new RabbitMQEventConsumer(
      this.channel,
      this.exchange,
      {
        queueNamePrefix: "bff_service_password_reset",
        routingKey: "user.password.reset",
        durable: true,
        autoDelete: false,
        maxRetries: this.maxRetries,
        waitingRoomTTL: this.waitingRoomTTL,
      },
      (event) => this.passwordResetEventHandler.handlePasswordReset(event)
    );

    // Setup queues and start consuming
    await this.nonCriticalConsumer.setupQueues();
    await this.nonCriticalConsumer.startConsuming();

    await this.channelDeletedConsumer.setupQueues();
    await this.channelDeletedConsumer.startConsuming();

    await this.workspaceDeletedConsumer.setupQueues();
    await this.workspaceDeletedConsumer.startConsuming();

    await this.passwordResetConsumer.setupQueues();
    await this.passwordResetConsumer.startConsuming();

    // Log queue names for debugging
    const channelQueues = this.channelDeletedConsumer.getQueueNames();
    const workspaceQueues = this.workspaceDeletedConsumer.getQueueNames();
    const passwordResetQueues = this.passwordResetConsumer.getQueueNames();

    logger.info("Event consumers initialized", {
      nonCritical: this.nonCriticalConsumer.getMainQueueName(),
      channelDeleted: channelQueues,
      workspaceDeleted: workspaceQueues,
      passwordReset: passwordResetQueues,
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
