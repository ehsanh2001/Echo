/**
 * Interface for RabbitMQ Consumer Worker
 * Handles consuming events from the echo.events exchange
 */
export interface IRabbitMQConsumer {
  /**
   * Initialize RabbitMQ connection and start consuming
   * Sets up exchange bindings and queue for channel.deleted events
   * @returns Promise that resolves when consumer is ready
   */
  initialize(): Promise<void>;

  /**
   * Stop consuming and close RabbitMQ connection gracefully
   * @returns Promise that resolves when connection is closed
   */
  close(): Promise<void>;

  /**
   * Check if consumer is connected and consuming
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean;
}
