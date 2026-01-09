import { Server as SocketIOServer } from "socket.io";

/**
 * Interface for RabbitMQ Consumer Service
 * Handles consuming events from multiple exchanges and broadcasting to Socket.IO
 */
export interface IRabbitMQConsumer {
  /**
   * Set the Socket.IO server instance
   * Must be called before initialize()
   * @param io - The Socket.IO server instance
   */
  setSocketServer(io: SocketIOServer): void;

  /**
   * Initialize RabbitMQ connection and start consuming
   * Sets up exchanges, queues, and bindings
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
