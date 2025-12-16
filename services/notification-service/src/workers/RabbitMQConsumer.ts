import { injectable, inject } from "tsyringe";
import amqp from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { runWithContextAsync } from "@echo/telemetry";
import { IRabbitMQConsumer } from "../interfaces/workers/IRabbitMQConsumer";
import { IInviteEventHandler } from "../interfaces/handlers/IInviteEventHandler";
import {
  NotificationEvent,
  WorkspaceInviteCreatedEvent,
} from "../types/events";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * RabbitMQ Consumer for Notification Service
 *
 * Consumes events from the shared echo.events exchange and processes
 * notification-related events (invites, mentions, etc.)
 *
 * Exchange consumed:
 * - 'echo.events' exchange: All service events
 *
 * Routing keys:
 * - workspace.invite.created: New workspace invitation
 *
 * Features:
 * - Automatic reconnection on connection failure with exponential backoff
 * - Manual message acknowledgment for reliable delivery
 * - Event routing to appropriate handlers
 * - Graceful shutdown
 */
@injectable()
export class RabbitMQConsumer implements IRabbitMQConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queueName = config.rabbitmq.queue;
  private readonly exchange = config.rabbitmq.exchange;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private isShuttingDown = false;

  constructor(
    @inject("IInviteEventHandler")
    private readonly inviteEventHandler: IInviteEventHandler
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
      logger.info("🔌 Connecting to RabbitMQ...", {
        url: this.maskRabbitMQUrl(config.rabbitmq.url),
        exchange: this.exchange,
        queue: this.queueName,
      });

      // Create connection
      const conn = await amqp.connect(config.rabbitmq.url);
      this.connection = conn;

      // Handle connection events
      conn.on("error", (error) => {
        logger.error("RabbitMQ connection error", { error });
        this.attemptReconnection();
      });

      conn.on("close", () => {
        logger.warn("RabbitMQ connection closed");
        this.attemptReconnection();
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

      // Declare queue for this service
      await ch.assertQueue(this.queueName, {
        exclusive: false, // Multiple instances can consume
        durable: true, // Persist queue across broker restarts
        autoDelete: false, // Keep queue when service disconnects
      });

      // Bind queue to exchange with routing keys for invite events
      await ch.bindQueue(
        this.queueName,
        this.exchange,
        "workspace.invite.created"
      );

      // Future: Add more bindings as needed
      // await ch.bindQueue(this.queueName, this.exchange, "channel.invite.created");
      // await ch.bindQueue(this.queueName, this.exchange, "message.mention.created");

      // Start consuming messages
      await ch.consume(this.queueName, (msg) => this.handleMessage(msg), {
        noAck: false, // Manual acknowledgment for reliability
      });

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      logger.info("✅ RabbitMQ consumer initialized", {
        queue: this.queueName,
        exchange: this.exchange,
        routingKeys: ["workspace.invite.created"],
      });
    } catch (error) {
      logger.error("Failed to initialize RabbitMQ consumer", { error });
      this.attemptReconnection();
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
      // Parse event payload
      const event: NotificationEvent = JSON.parse(msg.content.toString());

      // Extract correlationId and userId from event metadata
      const correlationId = event.metadata?.correlationId || uuidv4();
      const userId = event.metadata?.userId;

      // Run message processing in OTel context with userId
      await runWithContextAsync(
        { userId, timestamp: new Date() },
        async () => {
          logger.info("Received RabbitMQ event", {
            eventId: event.eventId,
            eventType: event.eventType,
            routingKey: msg.fields.routingKey,
            timestamp: event.timestamp,
            correlationId,
            userId,
          });

          // Route event to appropriate handler
          await this.routeEvent(event);

          // Acknowledge message after successful processing
          if (this.channel) {
            this.channel.ack(msg);
          }

          logger.debug("Message acknowledged", {
            eventId: event.eventId,
            eventType: event.eventType,
          });
        }
      );
    } catch (error) {
      logger.error("Error processing RabbitMQ message", {
        error,
        routingKey: msg.fields.routingKey,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // Reject message (don't requeue to avoid infinite loops)
      // In production, send to a dead letter queue
      if (this.channel) {
        this.channel.nack(msg, false, false);
      }
    }
  }

  /**
   * Route event to appropriate handler based on event type
   */
  private async routeEvent(event: NotificationEvent): Promise<void> {
    switch (event.eventType) {
      case "workspace.invite.created":
        await this.inviteEventHandler.handleWorkspaceInviteCreated(
          event as WorkspaceInviteCreatedEvent
        );
        break;

      default:
        logger.warn("Unknown event type received", {
          eventType: (event as any).eventType,
          eventId: event.eventId,
        });
    }
  }

  /**
   * Attempt to reconnect after connection loss
   * Uses exponential backoff and respects max retry attempts
   */
  private attemptReconnection(): void {
    // Don't reconnect if we're shutting down
    if (this.isShuttingDown) {
      logger.debug("Skipping reconnection - service is shutting down");
      return;
    }

    // Clean up connection state
    this.connection = null;
    this.channel = null;

    // Check max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("❌ Max reconnection attempts reached, giving up", {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.warn(`🔄 Attempting to reconnect to RabbitMQ in ${delay}ms`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    setTimeout(async () => {
      // Check again before attempting (shutdown may have occurred during delay)
      if (this.isShuttingDown) {
        logger.debug("Skipping reconnection - service is shutting down");
        return;
      }

      await this.initialize();
      // If initialize succeeds, reconnectAttempts is reset to 0 inside it
      // If it fails, the catch block will call attemptReconnection() again
    }, delay);
  }

  /**
   * Close RabbitMQ connection gracefully
   */
  async close(): Promise<void> {
    try {
      logger.info("Closing RabbitMQ consumer...");

      // Set shutdown flag to prevent reconnection attempts
      this.isShuttingDown = true;

      // Remove event listeners to prevent reconnection during shutdown
      if (this.connection) {
        this.connection.removeAllListeners("error");
        this.connection.removeAllListeners("close");
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

  /**
   * Mask sensitive information in RabbitMQ URL for logging
   */
  private maskRabbitMQUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.password) {
        urlObj.password = "****";
      }
      return urlObj.toString();
    } catch {
      return "amqp://****";
    }
  }
}
