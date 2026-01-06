import { MessageWithAuthorResponse } from "../../types";
import { IHealthService } from "./IHealthService";

/**
 * Message event for RabbitMQ publishing
 */
export interface MessageCreatedEvent {
  type: "message.created";
  payload: MessageWithAuthorResponse;
  timestamp: string;
  metadata: {
    timestamp: string;
    service: string;
    version: string;
    correlationId?: string;
    userId?: string;
  };
}

/**
 * Interface for RabbitMQ message publishing service
 */
export interface IRabbitMQService {
  /**
   * Publish a message created event to RabbitMQ
   * @param event - The message event to publish
   * @returns Promise that resolves when the event is published
   */
  publishMessageEvent(event: MessageCreatedEvent): Promise<void>;

  /**
   * Initialize RabbitMQ connection and setup
   * @returns Promise that resolves when connection is established
   */
  initialize(): Promise<void>;

  /**
   * Close RabbitMQ connection gracefully
   * @returns Promise that resolves when connection is closed
   */
  close(): Promise<void>;

  /**
   * Set health service for reporting connection status
   * @param healthService - The health service instance
   */
  setHealthService(healthService: IHealthService): void;
}
