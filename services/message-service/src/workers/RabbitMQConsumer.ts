import { injectable, inject } from "tsyringe";
import amqp from "amqplib";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import { IMessageService } from "../interfaces/services/IMessageService";
import { IHealthService } from "../interfaces/services/IHealthService";
import { IWorkspaceChannelServiceClient } from "../interfaces/external/IWorkspaceChannelServiceClient";
import { config } from "../config/env";
import logger from "../utils/logger";
import {
  RabbitMQEventConsumer,
  EventConsumerConfig,
} from "./RabbitMQEventConsumer";
import {
  ChannelDeletedEventPayload,
  WorkspaceDeletedEventPayload,
} from "../types/events";

/**
 * RabbitMQ Consumer for Message Service
 *
 * Orchestrates RabbitMQ connection and manages multiple event consumers.
 * Each event type (channel.deleted, workspace.deleted) is handled by a separate
 * RabbitMQEventConsumer instance.
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

  private channelDeletedConsumer: RabbitMQEventConsumer<ChannelDeletedEventPayload> | null =
    null;
  private workspaceDeletedConsumer: RabbitMQEventConsumer<WorkspaceDeletedEventPayload> | null =
    null;

  constructor(
    @inject("IMessageService") private readonly messageService: IMessageService,
    @inject("IHealthService") private readonly healthService: IHealthService,
    @inject("IWorkspaceChannelServiceClient")
    private readonly workspaceChannelServiceClient: IWorkspaceChannelServiceClient
  ) {}

  /**
   * Initialize RabbitMQ consumer
   */
  async initialize(): Promise<void> {
    if (this.isConnected()) {
      logger.warn("RabbitMQ consumer already connected");
      return;
    }

    try {
      logger.info("Connecting to RabbitMQ...");

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
      await ch.prefetch(5);

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

      // Create event consumers
      await this.setupEventConsumers();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Report healthy status to health service
      this.healthService.setRabbitMQConsumerHealth(true);

      logger.info("✅ RabbitMQ consumer initialized for message-service", {
        exchange: this.exchange,
        routingKeys: ["channel.deleted", "workspace.deleted"],
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

    // Configuration for channel.deleted consumer
    const channelDeletedConfig: EventConsumerConfig = {
      queueNamePrefix: "message_service_channel_deleted",
      routingKey: "channel.deleted",
      maxRetries: this.maxRetries,
      waitingRoomTTL: this.waitingRoomTTL,
    };

    // Configuration for workspace.deleted consumer
    const workspaceDeletedConfig: EventConsumerConfig = {
      queueNamePrefix: "message_service_workspace_deleted",
      routingKey: "workspace.deleted",
      maxRetries: this.maxRetries,
      waitingRoomTTL: this.waitingRoomTTL,
    };

    // Create channel.deleted consumer
    this.channelDeletedConsumer = new RabbitMQEventConsumer(
      this.channel,
      this.exchange,
      channelDeletedConfig,
      (event) => this.handleChannelDeleted(event)
    );

    // Create workspace.deleted consumer
    this.workspaceDeletedConsumer = new RabbitMQEventConsumer(
      this.channel,
      this.exchange,
      workspaceDeletedConfig,
      (event) => this.handleWorkspaceDeleted(event)
    );

    // Setup queues and start consuming
    await this.channelDeletedConsumer.setupQueues();
    await this.channelDeletedConsumer.startConsuming();

    await this.workspaceDeletedConsumer.setupQueues();
    await this.workspaceDeletedConsumer.startConsuming();

    // Log queue names for debugging
    const channelQueues = this.channelDeletedConsumer.getQueueNames();
    const workspaceQueues = this.workspaceDeletedConsumer.getQueueNames();

    logger.info("Event consumers initialized", {
      channelDeleted: channelQueues,
      workspaceDeleted: workspaceQueues,
    });
  }

  /**
   * Handle channel.deleted event
   * Invalidates membership cache and deletes all messages for the deleted channel
   */
  private async handleChannelDeleted(
    event: ChannelDeletedEventPayload
  ): Promise<void> {
    const { channelId, workspaceId, deletedBy } = event.data;

    logger.info("Processing channel deletion", {
      channelId,
      workspaceId,
      deletedBy,
    });

    try {
      // First, invalidate the channel membership cache to prevent stale cache hits
      const cacheEntriesDeleted =
        await this.workspaceChannelServiceClient.invalidateChannelMembershipCache(
          workspaceId,
          channelId
        );

      logger.info("Invalidated channel membership cache", {
        channelId,
        workspaceId,
        cacheEntriesDeleted,
      });

      // Then delete all messages for this channel
      const deletedCount = await this.messageService.deleteMessagesByChannel(
        workspaceId,
        channelId
      );

      logger.info("Successfully processed channel deletion", {
        channelId,
        workspaceId,
        deletedMessageCount: deletedCount,
        cacheEntriesDeleted,
      });
    } catch (error) {
      logger.error("Failed to process channel deletion", {
        channelId,
        workspaceId,
        error,
      });
      // Re-throw to trigger message nack
      throw error;
    }
  }

  /**
   * Handle workspace.deleted event
   * Invalidates all channel membership caches and deletes all messages for the workspace
   */
  private async handleWorkspaceDeleted(
    event: WorkspaceDeletedEventPayload
  ): Promise<void> {
    const { workspaceId, workspaceName, deletedBy, channelIds } = event.data;

    logger.info("Processing workspace deletion", {
      workspaceId,
      workspaceName,
      deletedBy,
      channelCount: channelIds.length,
    });

    try {
      // First, invalidate all channel membership caches for all channels in workspace
      const cacheInvalidationPromises = channelIds.map((channelId) =>
        this.workspaceChannelServiceClient
          .invalidateChannelMembershipCache(workspaceId, channelId)
          .catch((error) => {
            logger.warn("Failed to invalidate channel membership cache", {
              channelId,
              workspaceId,
              error,
            });
            return 0;
          })
      );

      const cacheEntriesDeletedArray = await Promise.all(
        cacheInvalidationPromises
      );
      const totalCacheEntriesDeleted = cacheEntriesDeletedArray.reduce(
        (sum, count) => sum + count,
        0
      );

      logger.info("Invalidated channel membership caches for workspace", {
        workspaceId,
        channelCount: channelIds.length,
        totalCacheEntriesDeleted,
      });

      // Then delete all messages for this workspace (all channels at once)
      const deletedCount =
        await this.messageService.deleteMessagesByWorkspace(workspaceId);

      logger.info("Successfully processed workspace deletion", {
        workspaceId,
        workspaceName,
        channelCount: channelIds.length,
        deletedMessageCount: deletedCount,
        totalCacheEntriesDeleted,
      });
    } catch (error) {
      logger.error("Failed to process workspace deletion", {
        workspaceId,
        workspaceName,
        error,
      });
      // Re-throw to trigger message nack
      throw error;
    }
  }

  /**
   * Handle connection close - attempt reconnection
   */
  private handleConnectionClose(): void {
    this.channel = null;
    this.connection = null;

    // Report unhealthy status to health service
    this.healthService.setRabbitMQConsumerHealth(false);

    // Attempt reconnection if not at max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      logger.info(
        `Attempting RabbitMQ reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      this.reconnectTimer = setTimeout(() => {
        this.initialize().catch((error) => {
          logger.error("RabbitMQ reconnection failed", { error });
        });
      }, delay);
    } else {
      logger.error(
        "Max RabbitMQ reconnection attempts reached. Manual intervention required."
      );
    }
  }

  /**
   * Close RabbitMQ connection gracefully
   */
  async close(): Promise<void> {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close channel
    if (this.channel) {
      try {
        await this.channel.close();
        logger.info("RabbitMQ channel closed");
      } catch (error) {
        logger.warn("Error closing RabbitMQ channel", { error });
      }
      this.channel = null;
    }

    // Close connection
    if (this.connection) {
      try {
        await this.connection.close();
        logger.info("RabbitMQ connection closed");
      } catch (error) {
        logger.warn("Error closing RabbitMQ connection", { error });
      }
      this.connection = null;
    }
  }

  /**
   * Check if consumer is connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }
}
