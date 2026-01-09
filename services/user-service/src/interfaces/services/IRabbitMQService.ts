/**
 * Interface for RabbitMQ service operations
 * Handles message publishing to RabbitMQ with lazy connection management
 */
export interface IRabbitMQService {
  /**
   * Establish connection to RabbitMQ server
   * Creates connection, channel, and declares exchange
   * Uses lazy connection strategy - called automatically on first publish
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails
   */
  connect(): Promise<void>;

  /**
   * Publish a message to RabbitMQ exchange
   * Automatically connects if not already connected (lazy connection)
   * @param routingKey - Routing key for topic exchange (e.g., "user.password.reset")
   * @param message - Message payload to publish (will be JSON stringified)
   * @returns Promise that resolves when message is published
   * @throws Error if publish fails
   */
  publish(routingKey: string, message: object): Promise<void>;

  /**
   * Gracefully disconnect from RabbitMQ
   * Closes channel and connection
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Check if currently connected to RabbitMQ
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;
}
