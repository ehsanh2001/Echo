import { injectable, inject } from "tsyringe";
import { PrismaClient, OutboxEvent } from "@prisma/client";
import logger from "../utils/logger";
import { IOutboxPublisher } from "../interfaces/workers/IOutboxPublisher";
import {
  IOutboxRepository,
  PrismaTransaction,
} from "../interfaces/repositories/IOutboxRepository";
import { IRabbitMQService } from "../interfaces/services/IRabbitMQService";
import { config } from "../config/env";
import type { EventPayload } from "../types";

/**
 * Outbox Publisher Background Worker
 *
 * Implements the Transactional Outbox Pattern by:
 * 1. Polling OutboxEvent table for pending events
 * 2. Publishing events to RabbitMQ
 * 3. Marking events as published or failed
 * 4. Handling retries and failures
 *
 * Features:
 * - Continuous polling at configurable intervals
 * - Batch processing for efficiency
 * - Best-effort chronological ordering (ORDER BY produced_at ASC)
 * - Graceful shutdown (completes current batch)
 * - Multi-instance safe (uses SELECT FOR UPDATE SKIP LOCKED)
 * - Failed events remain in table for manual inspection
 */
@injectable()
export class OutboxPublisher implements IOutboxPublisher {
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private processingBatch = false;
  private shutdownRequested = false;

  constructor(
    @inject("IOutboxRepository")
    private readonly outboxRepository: IOutboxRepository,
    @inject("IRabbitMQService")
    private readonly rabbitMQService: IRabbitMQService,
    private readonly prisma: PrismaClient
  ) {}

  /**
   * Start the background worker
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn("Outbox publisher already running");
      return;
    }

    this.running = true;
    this.shutdownRequested = false;

    logger.info("Starting Outbox Publisher Worker", {
      pollIntervalMs: config.worker.pollIntervalMs,
      batchSize: config.worker.batchSize,
      maxRetries: config.worker.maxRetries,
    });

    // Start polling loop
    this.startPolling();

    logger.info("Outbox Publisher Worker started");
  }

  /**
   * Stop the background worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) {
      logger.warn("Outbox publisher not running");
      return;
    }

    logger.info("Stopping Outbox Publisher Worker");
    this.shutdownRequested = true;

    // Stop polling timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for current batch to complete (with timeout)
    const shutdownTimeout = config.worker.shutdownTimeoutMs;
    const startTime = Date.now();

    while (this.processingBatch) {
      if (Date.now() - startTime > shutdownTimeout) {
        logger.warn("Shutdown timeout exceeded, forcing shutdown", {
          shutdownTimeoutMs: shutdownTimeout,
        });
        break;
      }
      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Disconnect from RabbitMQ
    await this.rabbitMQService.disconnect();

    this.running = false;
    logger.info("Outbox Publisher Worker stopped");
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Start polling loop
   */
  private startPolling(): void {
    const poll = async () => {
      // Don't start new batch if shutdown requested
      if (this.shutdownRequested) {
        return;
      }

      try {
        await this.processBatch();
      } catch (error) {
        logger.error("Error in polling cycle", { error });
      }

      // Schedule next poll if still running
      if (this.running && !this.shutdownRequested) {
        this.pollTimer = setTimeout(poll, config.worker.pollIntervalMs);
      }
    };

    // Start first poll
    poll();
  }

  /**
   * Process a batch of pending events
   *
   * CRITICAL: Each event must be fetched, published, and updated in the SAME transaction
   * to prevent race conditions. The SELECT FOR UPDATE SKIP LOCKED lock is only held
   * during the transaction - if we close the fetch transaction before processing,
   * another worker could grab the same events.
   *
   * Strategy: Fetch entire batch in one query with locks, then process each event
   * within the same transaction while locks are held.
   */
  private async processBatch(): Promise<void> {
    this.processingBatch = true;

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Fetch entire batch in one query with locks
          const events = await this.outboxRepository.findPending(
            tx,
            config.worker.batchSize
          );

          if (events.length === 0) {
            return { publishedCount: 0, failedCount: 0 };
          }

          logger.info("Processing outbox event batch", {
            eventCount: events.length,
          });

          let publishedCount = 0;
          let failedCount = 0;

          // Process each event while locks are still held
          for (const event of events) {
            try {
              await this.processEvent(event, tx);
              publishedCount++;
            } catch (error) {
              logger.error("Failed to process outbox event", {
                eventId: event.id,
                eventType: event.eventType,
                error: error instanceof Error ? error.message : error,
              });
              failedCount++;
              // Continue processing other events even if one fails
            }
          }

          return { publishedCount, failedCount };
        },
        {
          timeout: 30000, // 30 second timeout for entire batch
        }
      );

      if (result.publishedCount > 0 || result.failedCount > 0) {
        logger.info("Outbox batch processing complete", {
          publishedCount: result.publishedCount,
          failedCount: result.failedCount,
        });
      }
    } catch (error) {
      logger.error("Error processing outbox batch", { error });
    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Process a single outbox event
   * Publishes to RabbitMQ and updates status in database
   *
   * The event.payload field contains a fully structured EventPayload (e.g., WorkspaceInviteCreatedEventPayload)
   * which is published directly to RabbitMQ. This ensures consumers receive properly typed event data.
   *
   * @param event - The outbox event to process
   * @param tx - Prisma transaction for atomic status updates
   */
  private async processEvent(
    event: OutboxEvent,
    tx: PrismaTransaction
  ): Promise<void> {
    try {
      // Build routing key: {eventType}
      // Example: "workspace.invite.created", "channel.invite.created"
      const routingKey = event.eventType;

      // The payload is already a fully structured event (EventPayload)
      // Cast it to the proper type - it contains eventId, eventType, aggregateType,
      // aggregateId, timestamp, version, data, and metadata
      const eventPayload = event.payload as unknown as EventPayload;

      // Publish the complete event payload to RabbitMQ
      await this.rabbitMQService.publish(routingKey, eventPayload);

      // Mark as published in the same transaction
      await this.outboxRepository.markPublished(tx, event.id);

      logger.debug("Outbox event published successfully", {
        eventId: event.id,
        eventType: event.eventType,
        routingKey,
      });
    } catch (error) {
      // Mark as failed in the same transaction
      await this.outboxRepository.markFailed(tx, event.id);

      throw error; // Re-throw to be caught by batch processor
    }
  }
}
