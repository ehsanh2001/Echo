import { injectable } from "tsyringe";
import amqp from "amqplib";
import { IRabbitMQService } from "../interfaces/services/IRabbitMQService";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * RabbitMQ Service implementation with lazy connection management
 * Handles message publishing to RabbitMQ using topic exchange
 *
 * Features:
 * - Lazy connection (connects on first publish)
 * - Topic exchange for flexible routing
 * - Persistent message delivery
 * - Automatic reconnection on publish failure
 * - Graceful shutdown
 */
@injectable()
export class RabbitMQService implements IRabbitMQService {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private connecting: Promise<void> | null = null;
  private readonly exchangeName: string;
  private readonly exchangeType = "topic";

  constructor() {
    this.exchangeName = config.rabbitmq.exchange;
  }

  /**
   * Establish connection to RabbitMQ server
   * Creates connection, channel, and declares topic exchange
   */
  async connect(): Promise<void> {
    // If already connecting, wait for that connection to complete
    if (this.connecting) {
      return this.connecting;
    }

    // If already connected, do nothing
    if (this.isConnected()) {
      return;
    }

    // Start connection process
    this.connecting = this._connect();

    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  /**
   * Internal connection logic
   */
  private async _connect(): Promise<void> {
    try {
      logger.info("🔌 Connecting to RabbitMQ...");

      // Create connection
      const conn = await amqp.connect(config.rabbitmq.url);
      this.connection = conn;

      // Handle connection errors
      conn.on("error", (error) => {
        logger.error("❌ RabbitMQ connection error:", error);
        this.handleConnectionClose();
      });

      // Handle connection close
      conn.on("close", () => {
        logger.warn("⚠️  RabbitMQ connection closed");
        this.handleConnectionClose();
      });

      // Create channel
      const ch = await conn.createChannel();
      this.channel = ch;

      // Handle channel errors
      ch.on("error", (error) => {
        logger.error("❌ RabbitMQ channel error:", error);
      });

      // Handle channel close
      ch.on("close", () => {
        logger.warn("⚠️  RabbitMQ channel closed");
      });

      // Declare exchange (idempotent - safe to call multiple times)
      await ch.assertExchange(this.exchangeName, this.exchangeType, {
        durable: true, // Exchange survives broker restart
      });

      logger.info(
        `✅ RabbitMQ connected - Exchange: ${this.exchangeName} (${this.exchangeType})`
      );
    } catch (error) {
      logger.error("❌ Failed to connect to RabbitMQ:", error);
      this.handleConnectionClose();
      throw new Error(
        `Failed to connect to RabbitMQ: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Publish a message to RabbitMQ exchange
   * Implements lazy connection - connects automatically if not connected
   */
  async publish(routingKey: string, message: object): Promise<void> {
    try {
      // Lazy connection - connect if not already connected
      if (!this.isConnected()) {
        await this.connect();
      }

      if (!this.channel) {
        throw new Error("Channel not available after connection");
      }

      // Convert message to buffer
      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Publish message with persistent delivery mode
      const published = this.channel.publish(
        this.exchangeName,
        routingKey,
        messageBuffer,
        {
          persistent: true, // Message survives broker restart
          contentType: "application/json",
          timestamp: Date.now(),
        }
      );

      if (!published) {
        throw new Error(
          "Failed to publish message - channel write buffer full"
        );
      }

      logger.info(`📤 Published message - Routing key: ${routingKey}`);
    } catch (error) {
      logger.error(
        `❌ Failed to publish message (routing key: ${routingKey}):`,
        error
      );

      // If connection lost, try to reconnect and retry once
      if (
        error instanceof Error &&
        (error.message.includes("closed") ||
          error.message.includes("Channel closed"))
      ) {
        logger.info("🔄 Connection lost, attempting to reconnect and retry...");
        this.handleConnectionClose();

        try {
          await this.connect();
          await this.publish(routingKey, message); // Retry once
          return;
        } catch (retryError) {
          logger.error("❌ Retry failed:", retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }

  /**
   * Gracefully disconnect from RabbitMQ
   */
  async disconnect(): Promise<void> {
    try {
      logger.info("🔌 Disconnecting from RabbitMQ...");

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      logger.info("✅ RabbitMQ disconnected");
    } catch (error) {
      logger.error("❌ Error during RabbitMQ disconnect:", error);
      // Force cleanup even if close fails
      this.channel = null;
      this.connection = null;
    }
  }

  /**
   * Check if currently connected to RabbitMQ
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Handle connection/channel close
   * Cleans up references
   */
  private handleConnectionClose(): void {
    this.channel = null;
    this.connection = null;
    this.connecting = null;
  }
}
