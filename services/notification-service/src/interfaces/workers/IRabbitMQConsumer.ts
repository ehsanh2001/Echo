/**
 * RabbitMQ Consumer Interface
 * Defines the contract for consuming events from RabbitMQ
 */
export interface IRabbitMQConsumer {
  /**
   * Initialize the RabbitMQ consumer
   * - Connects to RabbitMQ
   * - Declares exchange and queue
   * - Binds queue to routing keys
   * - Starts consuming messages
   */
  initialize(): Promise<void>;

  /**
   * Close the RabbitMQ connection gracefully
   * - Stops consuming messages
   * - Closes channel
   * - Closes connection
   */
  close(): Promise<void>;

  /**
   * Check if the consumer is currently connected to RabbitMQ
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;
}
