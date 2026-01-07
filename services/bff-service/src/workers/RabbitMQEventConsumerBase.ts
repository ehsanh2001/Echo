import amqp from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { runWithContextAsync } from "@echo/telemetry";
import logger from "../utils/logger";

/**
 * Base configuration for event consumers
 */
export interface BaseEventConsumerConfig {
  queueNamePrefix: string;
  routingKey: string | string[]; // Support single or multiple routing keys
  durable: boolean;
  autoDelete: boolean;
}

/**
 * Handler function type for processing events
 */
export type EventHandler<T> = (event: T) => Promise<void>;

/**
 * Base class for RabbitMQ event consumers
 *
 * Provides common functionality for consuming events from RabbitMQ:
 * - Queue setup
 * - Message parsing
 * - Telemetry context propagation
 * - Acknowledgment handling
 *
 * Derived classes implement specific retry/failure handling strategies
 */
export abstract class RabbitMQEventConsumerBase<T> {
  protected readonly mainQueueName: string;

  constructor(
    protected readonly channel: amqp.Channel,
    protected readonly exchange: string,
    protected readonly config: BaseEventConsumerConfig,
    protected readonly handler: EventHandler<T>
  ) {
    this.mainQueueName = `${config.queueNamePrefix}_queue`;
  }

  /**
   * Set up queue - to be implemented by derived classes
   */
  abstract setupQueues(): Promise<void>;

  /**
   * Start consuming messages from the main queue
   */
  async startConsuming(): Promise<void> {
    await this.channel.consume(
      this.mainQueueName,
      (msg) => this.handleMessage(msg),
      {
        noAck: false,
      }
    );

    logger.info(`🎧 Started consuming from ${this.mainQueueName}`);
  }

  /**
   * Handle incoming message - can be overridden by derived classes
   */
  protected async handleMessage(
    msg: amqp.ConsumeMessage | null
  ): Promise<void> {
    if (!msg) {
      return;
    }

    let parsedEvent: T | null = null;

    try {
      // Parse event
      parsedEvent = JSON.parse(msg.content.toString()) as T;

      if (!parsedEvent) {
        throw new Error("Failed to parse message content");
      }

      const event = parsedEvent;

      // Extract metadata (support both 'metadata' and direct properties)
      const metadata = (event as any).metadata || {};
      const correlationId = metadata.correlationId || uuidv4();
      const userId = metadata.userId;

      // Build telemetry context
      const context: { timestamp: Date; userId?: string } = {
        timestamp: new Date(),
      };
      if (userId) {
        context.userId = userId;
      }

      // Process message in telemetry context
      await runWithContextAsync(context, async () => {
        const eventType =
          (event as any).eventType || (event as any).type || "unknown";

        logger.info(`Received ${eventType} event`, {
          eventType,
          eventId: (event as any).eventId,
          correlationId,
          routingKey: msg.fields.routingKey,
        });

        // Call the provided handler
        await this.handler(event);

        // Acknowledge message
        this.channel.ack(msg);

        logger.info(`Successfully processed ${eventType} event`, {
          eventType,
          eventId: (event as any).eventId,
          correlationId,
        });
      });
    } catch (error) {
      logger.error(`Error processing message`, {
        error,
        routingKey: msg.fields.routingKey,
        eventId: (parsedEvent as any)?.eventId,
        eventType:
          (parsedEvent as any)?.eventType || (parsedEvent as any)?.type,
      });

      await this.handleFailedMessage(msg, error);
    }
  }

  /**
   * Handle failed message - to be implemented by derived classes
   */
  protected abstract handleFailedMessage(
    msg: amqp.ConsumeMessage,
    error: unknown
  ): Promise<void>;

  /**
   * Bind queue to routing keys
   */
  protected async bindQueueToRoutingKeys(): Promise<void> {
    const routingKeys = Array.isArray(this.config.routingKey)
      ? this.config.routingKey
      : [this.config.routingKey];

    for (const routingKey of routingKeys) {
      await this.channel.bindQueue(
        this.mainQueueName,
        this.exchange,
        routingKey
      );
    }

    logger.info(`Bound queue to routing keys`, {
      queue: this.mainQueueName,
      routingKeys,
    });
  }

  /**
   * Get main queue name for logging/debugging
   */
  getMainQueueName(): string {
    return this.mainQueueName;
  }
}
