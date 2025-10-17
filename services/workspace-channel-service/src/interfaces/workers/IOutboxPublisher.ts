/**
 * Interface for Outbox Publisher background worker
 * Handles continuous polling of OutboxEvent table and publishing to RabbitMQ
 */
export interface IOutboxPublisher {
  /**
   * Start the background worker
   * Begins polling OutboxEvent table at configured intervals
   * Publishes pending events to RabbitMQ
   * @returns Promise that resolves when worker starts
   */
  start(): Promise<void>;

  /**
   * Stop the background worker gracefully
   * Stops polling loop and waits for current batch to complete
   * Disconnects from RabbitMQ
   * @returns Promise that resolves when worker stops
   */
  stop(): Promise<void>;

  /**
   * Check if worker is currently running
   * @returns true if worker is running, false otherwise
   */
  isRunning(): boolean;
}
