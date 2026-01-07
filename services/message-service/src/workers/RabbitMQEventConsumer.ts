import amqp from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { runWithContextAsync } from "@echo/telemetry";
import logger from "../utils/logger";
import { BaseEventPayload } from "../types/events";

/**
 * Configuration for RabbitMQ event consumer with DLX pattern
 */
export interface EventConsumerConfig {
  queueNamePrefix: string;
  routingKey: string;
  maxRetries: number;
  waitingRoomTTL: number;
}

/**
 * Handler function type for processing events
 */
export type EventHandler<T extends BaseEventPayload> = (
  event: T
) => Promise<void>;

/**
 * RabbitMQ Event Consumer
 *
 * Handles consumption of a single event type with DLX waiting room and parking lot patterns.
 * This class encapsulates all queue setup, message handling, and retry logic for one event type.
 *
 * Features:
 * - Automatic queue setup (main, waiting room, parking lot)
 * - DLX-based retry mechanism with exponential backoff
 * - Parking lot for permanently failed messages
 * - Work queue pattern for horizontal scaling
 * - Telemetry context propagation
 */
export class RabbitMQEventConsumer<T extends BaseEventPayload> {
  private readonly mainQueueName: string;
  private readonly waitingRoomQueueName: string;
  private readonly parkingLotQueueName: string;

  constructor(
    private readonly channel: amqp.Channel,
    private readonly exchange: string,
    private readonly config: EventConsumerConfig,
    private readonly handler: EventHandler<T>
  ) {
    this.mainQueueName = `${config.queueNamePrefix}_queue`;
    this.waitingRoomQueueName = `${config.queueNamePrefix}_queue_waiting_room`;
    this.parkingLotQueueName = `${config.queueNamePrefix}_queue_parking_lot`;
  }

  /**
   * Set up all queues with DLX configuration
   */
  async setupQueues(): Promise<void> {
    // Declare parking lot queue for permanently failed messages
    await this.channel.assertQueue(this.parkingLotQueueName, {
      exclusive: false,
      durable: true,
      autoDelete: false,
    });

    // Declare waiting room queue with TTL and dead letter back to main queue
    await this.channel.assertQueue(this.waitingRoomQueueName, {
      exclusive: false,
      durable: true,
      autoDelete: false,
      arguments: {
        "x-message-ttl": this.config.waitingRoomTTL,
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": this.mainQueueName,
      },
    });

    // Declare main queue with dead letter to waiting room
    await this.channel.assertQueue(this.mainQueueName, {
      exclusive: false,
      durable: true,
      autoDelete: false,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": this.waitingRoomQueueName,
      },
    });

    // Bind main queue to routing key
    await this.channel.bindQueue(
      this.mainQueueName,
      this.exchange,
      this.config.routingKey
    );

    logger.info(`Queues set up for ${this.config.routingKey}`, {
      mainQueue: this.mainQueueName,
      waitingRoom: this.waitingRoomQueueName,
      parkingLot: this.parkingLotQueueName,
      routingKey: this.config.routingKey,
    });
  }

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

    logger.info(`Started consuming from ${this.mainQueueName}`);
  }

  /**
   * Handle incoming message from RabbitMQ
   */
  private async handleMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
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

      // Extract metadata
      const correlationId = event.metadata?.correlationId || uuidv4();
      const userId = event.metadata?.userId;

      // Build telemetry context
      const context: { timestamp: Date; userId?: string } = {
        timestamp: new Date(),
      };
      if (userId) {
        context.userId = userId;
      }

      // Process message in telemetry context
      await runWithContextAsync(context, async () => {
        logger.info(`Received ${event.eventType} event`, {
          eventId: event.eventId,
          eventType: event.eventType,
          correlationId,
          routingKey: msg.fields.routingKey,
        });

        // Call the provided handler
        await this.handler(event);

        // Acknowledge message
        this.channel.ack(msg);

        logger.info(`Successfully processed ${event.eventType} event`, {
          eventId: event.eventId,
          eventType: event.eventType,
          correlationId,
        });
      });
    } catch (error) {
      logger.error(`Error processing ${this.config.routingKey} message`, {
        error,
        routingKey: msg.fields.routingKey,
        eventId: parsedEvent?.eventId,
        eventType: parsedEvent?.eventType,
      });

      await this.handleFailedMessage(msg, error);
    }
  }

  /**
   * Handle failed message processing with retry logic
   */
  private async handleFailedMessage(
    msg: amqp.ConsumeMessage,
    error: unknown
  ): Promise<void> {
    try {
      // Check x-death header to determine retry count
      const xDeath = msg.properties.headers?.["x-death"] as
        | Array<{ count: number; queue: string; reason: string }>
        | undefined;

      let retryCount = 0;
      if (xDeath) {
        const waitingRoomDeath = xDeath.find(
          (d) => d.queue === this.waitingRoomQueueName
        );
        retryCount = waitingRoomDeath?.count || 0;
      }

      logger.info("Message failure - checking retry count", {
        retryCount,
        maxRetries: this.config.maxRetries,
        willRetry: retryCount < this.config.maxRetries,
        routingKey: this.config.routingKey,
        xDeathInfo: xDeath?.map((d) => ({
          queue: d.queue,
          count: d.count,
          reason: d.reason,
        })),
      });

      if (retryCount < this.config.maxRetries) {
        // NACK - message will go to waiting room via DLX
        logger.info("NACK'ing message - will be retried via waiting room", {
          retryCount,
          nextRetry: retryCount + 1,
          waitingRoomTTL: `${this.config.waitingRoomTTL}ms`,
        });

        this.channel.nack(msg, false, false);
      } else {
        // Max retries exceeded - send to parking lot
        logger.error("Max retries exceeded - sending to parking lot", {
          retryCount,
          maxRetries: this.config.maxRetries,
          parkingLot: this.parkingLotQueueName,
          routingKey: this.config.routingKey,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : String(error),
        });

        // Add failure metadata
        const updatedProperties = {
          ...msg.properties,
          headers: {
            ...msg.properties.headers,
            "x-failure-reason":
              error instanceof Error ? error.message : String(error),
            "x-failure-timestamp": new Date().toISOString(),
            "x-original-queue": this.mainQueueName,
            "x-total-retries": retryCount,
          },
        };

        // Send to parking lot
        this.channel.sendToQueue(
          this.parkingLotQueueName,
          msg.content,
          updatedProperties
        );

        // ACK original message
        this.channel.ack(msg);
      }
    } catch (retryError) {
      logger.error("Error handling failed message - nacking without requeue", {
        retryError,
        originalError: error,
      });

      this.channel.nack(msg, false, false);
    }
  }

  /**
   * Get queue names for logging/debugging
   */
  getQueueNames(): {
    main: string;
    waitingRoom: string;
    parkingLot: string;
  } {
    return {
      main: this.mainQueueName,
      waitingRoom: this.waitingRoomQueueName,
      parkingLot: this.parkingLotQueueName,
    };
  }
}
