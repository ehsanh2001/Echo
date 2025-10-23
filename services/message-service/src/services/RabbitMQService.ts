import { injectable } from "tsyringe";
import amqp from "amqplib";
import {
  IRabbitMQService,
  MessageCreatedEvent,
} from "../interfaces/services/IRabbitMQService";
import { config } from "../config/env";

/**
 * RabbitMQ Service implementation for message-service
 * Handles publishing message events to RabbitMQ using topic exchange
 *
 * Features:
 * - Eager connection (connects on initialization)
 * - Topic exchange for flexible routing
 * - Persistent message delivery
 * - Graceful shutdown
 */
@injectable()
export class RabbitMQService implements IRabbitMQService {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName: string;
  private readonly exchangeType = "topic";

  constructor() {
    this.exchangeName = config.rabbitmq.exchange;
  }

  /**
   * Initialize RabbitMQ connection and setup
   */
  async initialize(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    try {
      console.log("🔌 Connecting to RabbitMQ...");

      // Create connection
      const conn = await amqp.connect(config.rabbitmq.url);
      this.connection = conn;

      // Handle connection errors
      conn.on("error", (error) => {
        console.error("❌ RabbitMQ connection error:", error);
        this.handleConnectionClose();
      });

      // Handle connection close
      conn.on("close", () => {
        console.warn("⚠️  RabbitMQ connection closed");
        this.handleConnectionClose();
      });

      // Create channel
      const ch = await conn.createChannel();
      this.channel = ch;

      // Handle channel errors
      ch.on("error", (error) => {
        console.error("❌ RabbitMQ channel error:", error);
      });

      // Handle channel close
      ch.on("close", () => {
        console.warn("⚠️  RabbitMQ channel closed");
      });

      // Declare exchange (idempotent - safe to call multiple times)
      await ch.assertExchange(this.exchangeName, this.exchangeType, {
        durable: true, // Exchange survives broker restart
      });

      console.log(
        `✅ RabbitMQ connected - Exchange: ${this.exchangeName} (${this.exchangeType})`
      );
    } catch (error) {
      console.error("❌ Failed to connect to RabbitMQ:", error);
      this.handleConnectionClose();
      throw new Error(
        `Failed to connect to RabbitMQ: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Publish a message created event to RabbitMQ
   */
  async publishMessageEvent(event: MessageCreatedEvent): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error("RabbitMQ not initialized - call initialize() first");
      }

      // Use the event type as routing key
      const routingKey = event.type; // e.g. "message.created"

      // Convert event to buffer
      const messageBuffer = Buffer.from(JSON.stringify(event));

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

      console.log(`📤 Published message event - Routing key: ${routingKey}`);
    } catch (error) {
      console.error(`❌ Failed to publish message event:`, error);

      // Don't throw - message creation should succeed even if event publish fails
      console.warn(
        "⚠️  Message event publishing failed, but message was created successfully"
      );
    }
  }

  /**
   * Close RabbitMQ connection gracefully
   */
  async close(): Promise<void> {
    try {
      console.log("🔌 Disconnecting from RabbitMQ...");

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      console.log("✅ RabbitMQ disconnected");
    } catch (error) {
      console.error("❌ Error during RabbitMQ disconnect:", error);
      // Force cleanup even if close fails
      this.channel = null;
      this.connection = null;
    }
  }

  /**
   * Check if currently connected to RabbitMQ
   */
  private isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Handle connection/channel close
   * Cleans up references
   */
  private handleConnectionClose(): void {
    this.channel = null;
    this.connection = null;
  }
}
