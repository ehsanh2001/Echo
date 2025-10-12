import { OutboxEvent, PrismaClient } from "@prisma/client";
import { CreateOutboxEventData } from "../../types";

// Type for Prisma transaction context
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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
   * Find and lock pending outbox events for processing (multi-instance safe)
   * Acquires locks within the provided transaction to prevent concurrent processing by multiple instances
   * @param tx - Prisma transaction context
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of locked pending events
   */
  findPending(tx: PrismaTransaction, limit?: number): Promise<OutboxEvent[]>;

  /**
   * Find and lock failed outbox events for retry (multi-instance safe)
   * Acquires locks within the provided transaction to prevent concurrent retry attempts by multiple instances
   * @param tx - Prisma transaction context
   * @param maxAttempts - Maximum failed attempts to consider for retry
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of locked failed events eligible for retry
   */
  findFailedForRetry(
    tx: PrismaTransaction,
    maxAttempts?: number,
    limit?: number
  ): Promise<OutboxEvent[]>;

  /**
   * Mark an outbox event as published within a transaction
   * @param tx - Prisma transaction context
   * @param id - The outbox event ID
   * @returns Promise resolving when event is marked as published
   */
  markPublished(tx: PrismaTransaction, id: string): Promise<void>;

  /**
   * Mark an outbox event as failed and increment the failed attempts counter within a transaction
   * This combines both status update and attempt counting for atomicity and efficiency
   * @param tx - Prisma transaction context
   * @param id - The outbox event ID
   * @returns Promise resolving when event is marked as failed and attempts incremented
   */
  markFailed(tx: PrismaTransaction, id: string): Promise<void>;

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
