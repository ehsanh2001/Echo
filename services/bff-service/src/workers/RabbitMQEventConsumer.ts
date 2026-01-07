import amqp from "amqplib";
import logger from "../utils/logger";
import {
  RabbitMQEventConsumerBase,
  BaseEventConsumerConfig,
  EventHandler,
} from "./RabbitMQEventConsumerBase";

/**
 * Configuration for event consumer with DLX waiting room pattern
 */
export interface EventConsumerConfigWithDLX extends BaseEventConsumerConfig {
  maxRetries: number;
  waitingRoomTTL: number;
}

/**
 * RabbitMQ Event Consumer with DLX Waiting Room Pattern
 *
 * Handles consumption of events with automatic retry using DLX pattern:
 * - Main queue → Waiting room (on NACK)
 * - Waiting room → Main queue (on TTL expiry)
 * - Parking lot (after max retries exceeded)
 *
 * Use this for critical events that must be processed reliably
 * (e.g., channel.deleted, workspace.deleted)
 */
export class RabbitMQEventConsumer<T> extends RabbitMQEventConsumerBase<T> {
  private readonly waitingRoomQueueName: string;
  private readonly parkingLotQueueName: string;
  private readonly dlxConfig: EventConsumerConfigWithDLX;

  constructor(
    channel: amqp.Channel,
    exchange: string,
    config: EventConsumerConfigWithDLX,
    handler: EventHandler<T>
  ) {
    super(channel, exchange, config, handler);
    this.dlxConfig = config;
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
        "x-message-ttl": this.dlxConfig.waitingRoomTTL,
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": this.mainQueueName,
      },
    });

    // Declare main queue with dead letter to waiting room
    await this.channel.assertQueue(this.mainQueueName, {
      exclusive: false,
      durable: this.config.durable,
      autoDelete: this.config.autoDelete,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": this.waitingRoomQueueName,
      },
    });

    // Bind queue to routing keys
    await this.bindQueueToRoutingKeys();

    logger.info(`✅ Queues set up with DLX pattern`, {
      mainQueue: this.mainQueueName,
      waitingRoom: this.waitingRoomQueueName,
      parkingLot: this.parkingLotQueueName,
      routingKeys: this.config.routingKey,
      maxRetries: this.dlxConfig.maxRetries,
      waitingRoomTTL: `${this.dlxConfig.waitingRoomTTL}ms`,
    });
  }

  /**
   * Handle failed message with retry logic
   */
  protected async handleFailedMessage(
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
        maxRetries: this.dlxConfig.maxRetries,
        willRetry: retryCount < this.dlxConfig.maxRetries,
        routingKey: msg.fields.routingKey,
        xDeathInfo: xDeath?.map((d) => ({
          queue: d.queue,
          count: d.count,
          reason: d.reason,
        })),
      });

      if (retryCount < this.dlxConfig.maxRetries) {
        // NACK - message will go to waiting room via DLX
        logger.info("NACK'ing message - will be retried via waiting room", {
          retryCount,
          nextRetry: retryCount + 1,
          waitingRoomTTL: `${this.dlxConfig.waitingRoomTTL}ms`,
        });

        this.channel.nack(msg, false, false);
      } else {
        // Max retries exceeded - send to parking lot
        logger.error("Max retries exceeded - sending to parking lot", {
          retryCount,
          maxRetries: this.dlxConfig.maxRetries,
          parkingLot: this.parkingLotQueueName,
          routingKey: msg.fields.routingKey,
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
