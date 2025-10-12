import { injectable } from "tsyringe";
import { PrismaClient, OutboxEvent, OutboxStatus } from "@prisma/client";
import {
  IOutboxRepository,
  PrismaTransaction,
} from "../interfaces/repositories/IOutboxRepository";
import { CreateOutboxEventData } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";
import { config } from "../config/env";

/**
 * Repository implementation for outbox event operations using Prisma
 */
@injectable()
export class OutboxRepository implements IOutboxRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new outbox event
   * @param data - Outbox event creation data
   * @returns Promise resolving to the created outbox event
   */
  async create(data: CreateOutboxEventData): Promise<OutboxEvent> {
    try {
      return await this.prisma.outboxEvent.create({
        data: {
          workspaceId: data.workspaceId,
          aggregateType: data.aggregateType,
          aggregateId: data.aggregateId,
          eventType: data.eventType,
          payload: data.payload,
          status: OutboxStatus.pending,
          failedAttempts: 0,
        },
      });
    } catch (error: any) {
      this.handleOutboxError(error, data);
    }
  }

  /**
   * Find and lock pending outbox events for processing (multi-instance safe)
   * Uses SELECT FOR UPDATE SKIP LOCKED within transaction to prevent race conditions
   * @param tx - Prisma transaction context
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of locked pending events
   */
  async findPending(
    tx: PrismaTransaction,
    limit: number = config.outbox.maxBatchSize
  ): Promise<OutboxEvent[]> {
    try {
      // Use raw SQL with FOR UPDATE SKIP LOCKED for multi-instance safety
      const lockedEvents = await tx.$queryRaw<any[]>`
        SELECT 
          id,
          workspace_id as "workspaceId",
          channel_id as "channelId", 
          aggregate_type as "aggregateType",
          aggregate_id as "aggregateId",
          event_type as "eventType",
          payload,
          produced_at as "producedAt",
          published_at as "publishedAt",
          failed_attempts as "failedAttempts",
          status
        FROM outbox_events 
        WHERE status = 'pending'
        ORDER BY produced_at ASC 
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      // Convert dates properly
      return lockedEvents.map((event) => ({
        ...event,
        producedAt: new Date(event.producedAt),
        publishedAt: event.publishedAt ? new Date(event.publishedAt) : null,
      })) as OutboxEvent[];
    } catch (error: any) {
      this.handleOutboxError(error);
    }
  }

  /**
   * Find and lock failed outbox events for retry (multi-instance safe)
   * Uses SELECT FOR UPDATE SKIP LOCKED within transaction to prevent race conditions
   * @param tx - Prisma transaction context
   * @param maxAttempts - Maximum failed attempts to consider for retry
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of locked failed events eligible for retry
   */
  async findFailedForRetry(
    tx: PrismaTransaction,
    maxAttempts: number = config.outbox.maxRetryAttempts,
    limit: number = config.outbox.maxBatchSize
  ): Promise<OutboxEvent[]> {
    try {
      // Use raw SQL with FOR UPDATE SKIP LOCKED for multi-instance safety
      const lockedEvents = await tx.$queryRaw<any[]>`
        SELECT 
          id,
          workspace_id as "workspaceId",
          channel_id as "channelId", 
          aggregate_type as "aggregateType",
          aggregate_id as "aggregateId",
          event_type as "eventType",
          payload,
          produced_at as "producedAt",
          published_at as "publishedAt",
          failed_attempts as "failedAttempts",
          status
        FROM outbox_events 
        WHERE status = 'failed' AND failed_attempts < ${maxAttempts}
        ORDER BY produced_at ASC 
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      // Convert dates properly
      return lockedEvents.map((event) => ({
        ...event,
        producedAt: new Date(event.producedAt),
        publishedAt: event.publishedAt ? new Date(event.publishedAt) : null,
      })) as OutboxEvent[];
    } catch (error: any) {
      this.handleOutboxError(error);
    }
  }

  /**
   * Mark an outbox event as published within a transaction
   * @param tx - Prisma transaction context
   * @param id - The outbox event ID
   * @returns Promise resolving when event is marked as published
   */
  async markPublished(tx: PrismaTransaction, id: string): Promise<void> {
    try {
      await tx.outboxEvent.update({
        where: { id },
        data: {
          status: OutboxStatus.published,
          publishedAt: new Date(),
        },
      });
    } catch (error: any) {
      this.handleOutboxError(error, undefined, id);
    }
  }

  /**
   * Mark an outbox event as failed and increment the failed attempts counter within a transaction
   * Combines both operations into a single atomic update for efficiency
   * @param tx - Prisma transaction context
   * @param id - The outbox event ID
   * @returns Promise resolving when event is marked as failed and attempts incremented
   */
  async markFailed(tx: PrismaTransaction, id: string): Promise<void> {
    try {
      await tx.outboxEvent.update({
        where: { id },
        data: {
          status: OutboxStatus.failed,
          failedAttempts: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      this.handleOutboxError(error, undefined, id);
    }
  }

  /**
   * Delete old published events (cleanup operation)
   * @param olderThan - Delete events published before this date
   * @returns Promise resolving to number of deleted events
   */
  async deleteOldPublished(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.outboxEvent.deleteMany({
        where: {
          status: OutboxStatus.published,
          publishedAt: {
            lt: olderThan,
          },
        },
      });

      return result.count;
    } catch (error: any) {
      this.handleOutboxError(error);
    }
  }

  /**
   * Find outbox events by aggregate
   * @param aggregateType - The aggregate type
   * @param aggregateId - The aggregate ID
   * @returns Promise resolving to array of events for the aggregate
   */
  async findByAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<OutboxEvent[]> {
    try {
      return await this.prisma.outboxEvent.findMany({
        where: {
          aggregateType,
          aggregateId,
        },
        orderBy: {
          producedAt: "asc",
        },
      });
    } catch (error: any) {
      this.handleOutboxError(error);
    }
  }

  /**
   * Handle outbox-specific errors and convert them to appropriate service errors
   * @param error - The Prisma error
   * @param eventData - The outbox event data that caused the error (for context)
   * @param eventId - The outbox event ID that caused the error (for update/delete operations)
   */
  private handleOutboxError(
    error: any,
    eventData?: CreateOutboxEventData,
    eventId?: string
  ): never {
    console.error("Error in outbox operation:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      throw WorkspaceChannelServiceError.conflict(
        "Outbox event already exists with the provided data"
      );
    }

    // Handle foreign key constraint violations
    if (error.code === "P2003") {
      const constraint = error.meta?.constraint || "";

      if (constraint.includes("workspace")) {
        throw WorkspaceChannelServiceError.notFound(
          "Workspace",
          eventData?.workspaceId || "unknown"
        );
      }

      throw WorkspaceChannelServiceError.badRequest(
        "Invalid reference in outbox event data"
      );
    }

    // Handle not found errors
    if (error.code === "P2025") {
      throw WorkspaceChannelServiceError.notFound(
        "OutboxEvent",
        eventId || "unknown"
      );
    }

    // Generic database error
    throw WorkspaceChannelServiceError.database(
      "Database operation failed for outbox event"
    );
  }
}
