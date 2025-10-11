import { OutboxEvent } from "@prisma/client";
import { CreateOutboxEventData } from "../../types";

/**
 * Repository interface for outbox event operations
 */
export interface IOutboxRepository {
  /**
   * Create a new outbox event
   * @param data - Outbox event creation data
   * @returns Promise resolving to the created outbox event
   */
  create(data: CreateOutboxEventData): Promise<OutboxEvent>;

  /**
   * Find pending outbox events for processing
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of pending events
   */
  findPending(limit?: number): Promise<OutboxEvent[]>;

  /**
   * Find failed outbox events for retry
   * @param maxAttempts - Maximum failed attempts to consider for retry
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of failed events eligible for retry
   */
  findFailedForRetry(
    maxAttempts?: number,
    limit?: number
  ): Promise<OutboxEvent[]>;

  /**
   * Mark an outbox event as published
   * @param id - The outbox event ID
   * @returns Promise resolving when event is marked as published
   */
  markPublished(id: string): Promise<void>;

  /**
   * Mark an outbox event as failed
   * @param id - The outbox event ID
   * @returns Promise resolving when event is marked as failed
   */
  markFailed(id: string): Promise<void>;

  /**
   * Increment failed attempts counter for an outbox event
   * @param id - The outbox event ID
   * @returns Promise resolving when failed attempts is incremented
   */
  incrementFailedAttempts(id: string): Promise<void>;

  /**
   * Delete old published events (cleanup operation)
   * @param olderThan - Delete events published before this date
   * @returns Promise resolving to number of deleted events
   */
  deleteOldPublished(olderThan: Date): Promise<number>;

  /**
   * Find outbox events by aggregate
   * @param aggregateType - The aggregate type
   * @param aggregateId - The aggregate ID
   * @returns Promise resolving to array of events for the aggregate
   */
  findByAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<OutboxEvent[]>;
}
