import amqp from "amqplib";
import logger from "../utils/logger";
import { RabbitMQEventConsumerBase } from "./RabbitMQEventConsumerBase";

/**
 * RabbitMQ Event Consumer without DLX Pattern
 *
 * Handles consumption of non-critical events without retry mechanism.
 * Failed messages are simply NACK'd without requeue to avoid infinite loops.
 *
 * Use this for real-time events that can be missed without critical impact
 * (e.g., message.created, member.joined)
 */
export class RabbitMQEventConsumerNoDLX<
  T,
> extends RabbitMQEventConsumerBase<T> {
  /**
   * Set up queue without DLX configuration
   */
  async setupQueues(): Promise<void> {
    // Declare main queue (ephemeral for non-critical events)
    await this.channel.assertQueue(this.mainQueueName, {
      exclusive: false,
      durable: this.config.durable,
      autoDelete: this.config.autoDelete,
    });

    // Bind queue to routing keys
    await this.bindQueueToRoutingKeys();

    logger.info(`✅ Queue set up without DLX pattern`, {
      mainQueue: this.mainQueueName,
      routingKeys: this.config.routingKey,
      durable: this.config.durable,
      autoDelete: this.config.autoDelete,
    });
  }

  /**
   * Handle failed message - simply NACK without requeue
   */
  protected async handleFailedMessage(
    msg: amqp.ConsumeMessage,
    error: unknown
  ): Promise<void> {
    logger.error("Failed to process message - NACK'ing without requeue", {
      routingKey: msg.fields.routingKey,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
    });

    // NACK without requeue to avoid infinite loops
    this.channel.nack(msg, false, false);
  }
}
