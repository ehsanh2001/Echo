import { injectable, inject } from "tsyringe";
import amqp from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { runWithContextAsync } from "@echo/telemetry";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import { IMessageService } from "../interfaces/services/IMessageService";
import { IHealthService } from "../interfaces/services/IHealthService";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * Event payload structure for channel.deleted events
 */
interface ChannelDeletedEventPayload {
  eventId: string;
  eventType: "channel.deleted";
  aggregateType: "channel";
  aggregateId: string;
  timestamp: string;
  version: string;
  data: {
    channelId: string;
    workspaceId: string;
    channelName: string;
    deletedBy: string;
  };
  metadata: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    traceId?: string;
  };
}

/**
 * RabbitMQ Consumer for Message Service
 *
 * Consumes channel.deleted events from the echo.events exchange to delete
 * all messages associated with a deleted channel.
 *
 * Features:
 * - Topic routing for channel.deleted events
 * - Automatic reconnection on connection failure
 * - Message acknowledgment for reliable delivery
 * - Work queue pattern for multiple service instances
 * - Implements Waiting Room and Parking Lot patterns for failed message processing
 * - Graceful shutdown
 */
@injectable()
export class RabbitMQConsumer implements IRabbitMQConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queueName: string;
  private readonly waitingRoomQueueName: string;
  private readonly parkingLotQueueName: string;
  private readonly exchange = config.rabbitmq.exchange;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly maxRetries = 3;
  private readonly waitingRoomTTL = 30000; // 30 seconds

  constructor(
    @inject("IMessageService") private readonly messageService: IMessageService,
    @inject("IHealthService") private readonly healthService: IHealthService
  ) {
    // All message-service instances share the same queue (work queue pattern)
    this.queueName = `message_service_channel_deleted_queue`;
    this.waitingRoomQueueName = `${this.queueName}_waiting_room`;
    this.parkingLotQueueName = `${this.queueName}_parking_lot`;
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
      logger.info("Connecting to RabbitMQ for channel.deleted events...");

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
      // Lower value since message deletion can be a heavy operation
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

      // Declare parking lot queue for permanently failed messages (after 3 retries)
      await ch.assertQueue(this.parkingLotQueueName, {
        exclusive: false, // Shared among all message-service instances
        durable: true, // Persist queue to survive broker restarts
        autoDelete: false, // Keep queue even when no consumers
      });

      // Declare waiting room queue with TTL and dead letter back to main queue
      // Messages stay here for 30 seconds before being retried
      // Uses default exchange ("") to route directly to main queue by name
      await ch.assertQueue(this.waitingRoomQueueName, {
        exclusive: false,
        durable: true,
        autoDelete: false,
        arguments: {
          "x-message-ttl": this.waitingRoomTTL, // 30 seconds
          "x-dead-letter-exchange": "", // Default exchange for direct queue routing
          "x-dead-letter-routing-key": this.queueName, // Route back to main queue
        },
      });

      // Declare main queue for channel.deleted events
      // When messages are NACK'd, they go to waiting room via DLX
      // Durable to survive broker restarts - we don't want to miss channel deletions
      await ch.assertQueue(this.queueName, {
        exclusive: false,
        durable: true,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "", // Default exchange for direct queue routing
          "x-dead-letter-routing-key": this.waitingRoomQueueName, // NACK'd messages go to waiting room
        },
      });

      // Bind main queue to channel.deleted routing key
      await ch.bindQueue(this.queueName, this.exchange, "channel.deleted");

      // Start consuming
      await ch.consume(this.queueName, (msg) => this.handleMessage(msg), {
        noAck: false, // Manual acknowledgment for reliability
      });

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Report healthy status to health service
      this.healthService.setRabbitMQConsumerHealth(true);

      logger.info("✅ RabbitMQ consumer initialized for message-service", {
        queue: this.queueName,
        waitingRoom: this.waitingRoomQueueName,
        parkingLot: this.parkingLotQueueName,
        exchange: this.exchange,
        routingKey: "channel.deleted",
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

    let parsedEvent: ChannelDeletedEventPayload | null = null;

    try {
      // Parse event
      parsedEvent = JSON.parse(msg.content.toString());

      if (!parsedEvent) {
        throw new Error("Failed to parse message content");
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
        logger.info("Received channel.deleted event", {
          eventId: event.eventId,
          channelId: event.data.channelId,
          workspaceId: event.data.workspaceId,
          deletedBy: event.data.deletedBy,
          correlationId,
          routingKey: msg.fields.routingKey,
        });

        // Handle channel deletion by deleting all messages
        await this.handleChannelDeleted(event);

        // Acknowledge message
        if (this.channel) {
          this.channel.ack(msg);
        }

        logger.info("Successfully processed channel.deleted event", {
          eventId: event.eventId,
          channelId: event.data.channelId,
          correlationId,
        });
      });
    } catch (error) {
      logger.error("Error processing channel.deleted message", {
        error,
        routingKey: msg.fields.routingKey,
        eventId: parsedEvent?.eventId,
      });

      // Implement waiting room and parking lot pattern for failed messages
      await this.handleFailedMessage(msg, error);
    }
  }

  /**
   * Handle failed message processing with retry logic
   * Uses DLX configuration for automatic routing:
   * - Main queue DLX → Waiting room (on NACK)
   * - Waiting room DLX → Main queue (on TTL expiry)
   * - Parking lot for messages that exceed max retries
   */
  private async handleFailedMessage(
    msg: amqp.ConsumeMessage,
    error: unknown
  ): Promise<void> {
    if (!this.channel) {
      return;
    }

    try {
      // Check x-death header to determine retry count
      // x-death tracks how many times message was dead-lettered from each queue
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

      logger.info("Message failure - checking retry count", {
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
        // After TTL expires in waiting room, it will automatically come back
        logger.info("NACK'ing message - will be retried via waiting room", {
          retryCount,
          nextRetry: retryCount + 1,
          waitingRoomTTL: `${this.waitingRoomTTL}ms`,
        });

        // NACK without requeue - DLX will route to waiting room
        this.channel.nack(msg, false, false);
      } else {
        // Max retries exceeded - send to parking lot manually
        logger.error("Max retries exceeded - sending to parking lot", {
          retryCount,
          maxRetries: this.maxRetries,
          parkingLot: this.parkingLotQueueName,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : String(error),
        });

        // Add failure information to message headers
        const updatedProperties = {
          ...msg.properties,
          headers: {
            ...msg.properties.headers,
            "x-failure-reason":
              error instanceof Error ? error.message : String(error),
            "x-failure-timestamp": new Date().toISOString(),
            "x-original-queue": this.queueName,
            "x-total-retries": retryCount,
          },
        };

        // Send to parking lot for manual inspection
        this.channel.sendToQueue(
          this.parkingLotQueueName,
          msg.content,
          updatedProperties
        );

        // ACK the original message since we've handled it (moved to parking lot)
        this.channel.ack(msg);
      }
    } catch (retryError) {
      logger.error("Error handling failed message - nacking without requeue", {
        retryError,
        originalError: error,
      });

      // If we can't even handle the retry logic, nack without requeue
      // This will still go to waiting room via DLX
      this.channel.nack(msg, false, false);
    }
  }

  /**
   * Handle channel.deleted event
   * Deletes all messages for the deleted channel
   */
  private async handleChannelDeleted(
    event: ChannelDeletedEventPayload
  ): Promise<void> {
    const { channelId, workspaceId, deletedBy } = event.data;

    logger.info("Processing channel deletion - deleting all messages", {
      channelId,
      workspaceId,
      deletedBy,
    });

    try {
      // Delete all messages for this channel
      const deletedCount = await this.messageService.deleteMessagesByChannel(
        workspaceId,
        channelId
      );

      logger.info("Successfully deleted messages for channel", {
        channelId,
        workspaceId,
        deletedCount,
      });
    } catch (error) {
      logger.error("Failed to delete messages for channel", {
        channelId,
        workspaceId,
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
