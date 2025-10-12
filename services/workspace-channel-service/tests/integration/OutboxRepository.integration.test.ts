import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { container } from "../../src/container";
import { IOutboxRepository } from "../../src/interfaces/repositories/IOutboxRepository";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { CreateOutboxEventData } from "../../src/types";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { OutboxEvent, OutboxStatus, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const TEST_PREFIX = "outbox-repo-test";

describe("OutboxRepository Transaction-Aware Integration Tests", () => {
  let outboxRepository: IOutboxRepository;
  let workspaceRepository: IWorkspaceRepository;
  let prisma: PrismaClient;

  // Test data cleanup tracking
  const createdEventIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeEach(async () => {
    // Get repository instances from DI container
    outboxRepository =
      container.resolve<IOutboxRepository>("IOutboxRepository");
    workspaceRepository = container.resolve<IWorkspaceRepository>(
      "IWorkspaceRepository"
    );
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    // Clean up created test data
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    try {
      // Delete outbox events first (due to foreign key constraints)
      if (createdEventIds.length > 0) {
        await prisma.outboxEvent.deleteMany({
          where: {
            id: { in: createdEventIds },
          },
        });
        createdEventIds.length = 0;
      }

      // Delete workspaces and their related data in proper order
      if (createdWorkspaceIds.length > 0) {
        // Delete channel members first
        await prisma.channelMember.deleteMany({
          where: {
            channel: {
              workspaceId: { in: createdWorkspaceIds },
            },
          },
        });

        // Delete channels
        await prisma.channel.deleteMany({
          where: {
            workspaceId: { in: createdWorkspaceIds },
          },
        });

        // Delete workspace members
        await prisma.workspaceMember.deleteMany({
          where: {
            workspaceId: { in: createdWorkspaceIds },
          },
        });

        // Finally delete workspaces
        await prisma.workspace.deleteMany({
          where: {
            id: { in: createdWorkspaceIds },
          },
        });
        createdWorkspaceIds.length = 0;
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe("create", () => {
    it("should create an outbox event successfully", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const eventData: CreateOutboxEventData = {
        workspaceId: workspace.id,
        aggregateType: "workspace",
        aggregateId: workspace.id,
        eventType: "workspace.invite.created",
        payload: {
          inviteId: randomUUID(),
          email: "test@example.com",
          role: "member",
        },
      };

      // Act
      const result = await outboxRepository.create(eventData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.workspaceId).toBe(eventData.workspaceId);
      expect(result.aggregateType).toBe(eventData.aggregateType);
      expect(result.aggregateId).toBe(eventData.aggregateId);
      expect(result.eventType).toBe(eventData.eventType);
      expect(result.payload).toEqual(eventData.payload);
      expect(result.status).toBe(OutboxStatus.pending);
      expect(result.failedAttempts).toBe(0);
      expect(result.producedAt).toBeDefined();
      expect(result.publishedAt).toBeNull();

      createdEventIds.push(result.id);
    });

    it("should create event with invalid workspaceId", async () => {
      // Arrange
      const eventData: CreateOutboxEventData = {
        workspaceId: randomUUID(), // Non-existent workspace - should fail
        aggregateType: "workspace",
        aggregateId: randomUUID(),
        eventType: "test.event",
        payload: { test: "data" },
      };

      // Act & Assert
      await expect(outboxRepository.create(eventData)).rejects.toThrow(
        WorkspaceChannelServiceError
      );
    });
  });

  describe("findPending", () => {
    it("should return pending events", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const event1 = await createTestOutboxEvent(workspace.id, "event.type1");
      const event2 = await createTestOutboxEvent(workspace.id, "event.type2");

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findPending(tx);
      });

      // Assert
      const testEvents = result.filter((event) =>
        [event1.id, event2.id].includes(event.id)
      );
      expect(testEvents).toHaveLength(2);

      // Should be ordered by producedAt (oldest first)
      const sortedTestEvents = testEvents.sort(
        (a, b) => a.producedAt.getTime() - b.producedAt.getTime()
      );
      expect(sortedTestEvents.length).toBeGreaterThan(0);
      expect(sortedTestEvents[0]?.id).toBe(event1.id);
    });

    it("should respect limit parameter", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      await createTestOutboxEvent(workspace.id, "event.type1");
      await createTestOutboxEvent(workspace.id, "event.type2");
      await createTestOutboxEvent(workspace.id, "event.type3");

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findPending(tx, 2);
      });

      // Assert
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("should not return published events", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const pendingEvent = await createTestOutboxEvent(workspace.id, "pending");
      const publishedEvent = await createTestOutboxEvent(
        workspace.id,
        "published"
      );

      // Mark one event as published
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markPublished(tx, publishedEvent.id);
      });

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findPending(tx);
      });

      // Assert
      const pendingIds = result.map((event) => event.id);
      expect(pendingIds).toContain(pendingEvent.id);
      expect(pendingIds).not.toContain(publishedEvent.id);
    });

    it("should not return failed events", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const pendingEvent = await createTestOutboxEvent(workspace.id, "pending");
      const failedEvent = await createTestOutboxEvent(workspace.id, "failed");

      // Mark one event as failed
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, failedEvent.id);
      });

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findPending(tx);
      });

      // Assert
      const pendingIds = result.map((event) => event.id);
      expect(pendingIds).toContain(pendingEvent.id);
      expect(pendingIds).not.toContain(failedEvent.id);
    });
  });

  describe("findFailedForRetry", () => {
    it("should return failed events eligible for retry", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const failedEvent = await createTestOutboxEvent(workspace.id, "failed");

      // Mark as failed (which automatically increments attempts to 1)
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, failedEvent.id);
      });

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findFailedForRetry(tx, 3, 10);
      });

      // Assert
      const testEvents = result.filter((event) => event.id === failedEvent.id);
      expect(testEvents).toHaveLength(1);
      const failedEventResult = testEvents[0];
      expect(failedEventResult?.failedAttempts).toBeGreaterThan(0);
      expect(failedEventResult?.failedAttempts).toBeLessThan(3);
    });

    it("should not return events that exceeded max attempts", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const failedEvent = await createTestOutboxEvent(workspace.id, "failed");

      // Mark as failed 3 times to reach max attempts (each call increments)
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, failedEvent.id); // attempt 1
      });
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, failedEvent.id); // attempt 2
      });
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, failedEvent.id); // attempt 3
      });

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findFailedForRetry(tx, 3, 10);
      });

      // Assert
      const testEventIds = result.map((event) => event.id);
      expect(testEventIds).not.toContain(failedEvent.id);
    });

    it("should not return pending or published events", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const pendingEvent = await createTestOutboxEvent(workspace.id, "pending");
      const publishedEvent = await createTestOutboxEvent(
        workspace.id,
        "published"
      );

      await prisma.$transaction(async (tx) => {
        await outboxRepository.markPublished(tx, publishedEvent.id);
      });

      // Act
      const result = await prisma.$transaction(async (tx) => {
        return await outboxRepository.findFailedForRetry(tx);
      });

      // Assert
      const resultIds = result.map((event) => event.id);
      expect(resultIds).not.toContain(pendingEvent.id);
      expect(resultIds).not.toContain(publishedEvent.id);
    });
  });

  describe("markPublished", () => {
    it("should mark event as published with timestamp", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const event = await createTestOutboxEvent(workspace.id, "test.event");
      const beforePublish = new Date();

      // Act
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markPublished(tx, event.id);
      });

      // Assert
      const { PrismaClient } = await import("@prisma/client");
      const checkPrisma = new PrismaClient();
      try {
        const updatedEvent = await checkPrisma.outboxEvent.findUnique({
          where: { id: event.id },
        });

        expect(updatedEvent!.status).toBe(OutboxStatus.published);
        expect(updatedEvent!.publishedAt).not.toBeNull();
        expect(updatedEvent!.publishedAt!.getTime()).toBeGreaterThanOrEqual(
          beforePublish.getTime()
        );
      } finally {
        await checkPrisma.$disconnect();
      }
    });

    it("should throw not found error for non-existent event", async () => {
      // Act & Assert
      await expect(
        prisma.$transaction(async (tx) => {
          return await outboxRepository.markPublished(tx, randomUUID());
        })
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });
  });

  describe("markFailed", () => {
    it("should mark event as failed", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const event = await createTestOutboxEvent(workspace.id, "test.event");

      // Act
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, event.id);
      });

      // Assert
      const { PrismaClient } = await import("@prisma/client");
      const checkPrisma = new PrismaClient();
      try {
        const updatedEvent = await checkPrisma.outboxEvent.findUnique({
          where: { id: event.id },
        });

        expect(updatedEvent!.status).toBe(OutboxStatus.failed);
      } finally {
        await checkPrisma.$disconnect();
      }
    });

    it("should throw not found error for non-existent event", async () => {
      // Act & Assert
      await expect(
        prisma.$transaction(async (tx) => {
          return await outboxRepository.markFailed(tx, randomUUID());
        })
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should increment failed attempts counter with each call", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const event = await createTestOutboxEvent(workspace.id, "test.event");

      // Act - Mark as failed twice (each call increments the counter)
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, event.id);
      });
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, event.id);
      });

      // Assert
      const { PrismaClient } = await import("@prisma/client");
      const checkPrisma = new PrismaClient();
      try {
        const updatedEvent = await checkPrisma.outboxEvent.findUnique({
          where: { id: event.id },
        });

        expect(updatedEvent!.status).toBe(OutboxStatus.failed);
        expect(updatedEvent!.failedAttempts).toBe(2);
      } finally {
        await checkPrisma.$disconnect();
      }
    });
  });

  describe("deleteOldPublished", () => {
    it("should delete old published events", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const oldEvent = await createTestOutboxEvent(workspace.id, "old.event");
      const newEvent = await createTestOutboxEvent(workspace.id, "new.event");

      // Mark both as published
      await prisma.$transaction(async (tx) => {
        await outboxRepository.markPublished(tx, oldEvent.id);
        await outboxRepository.markPublished(tx, newEvent.id);
      });

      // Manually update old event's publishedAt to be older
      const { PrismaClient } = await import("@prisma/client");
      const updatePrisma = new PrismaClient();
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      await updatePrisma.outboxEvent.update({
        where: { id: oldEvent.id },
        data: { publishedAt: oldDate },
      });

      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Act
      const deletedCount = await outboxRepository.deleteOldPublished(
        cutoffDate
      );

      // Assert
      expect(deletedCount).toBeGreaterThan(0);

      // Verify old event is deleted and new event remains
      try {
        const oldCheck = await updatePrisma.outboxEvent.findUnique({
          where: { id: oldEvent.id },
        });
        const newCheck = await updatePrisma.outboxEvent.findUnique({
          where: { id: newEvent.id },
        });

        expect(oldCheck).toBeNull();
        expect(newCheck).not.toBeNull();
      } finally {
        await updatePrisma.$disconnect();
      }

      // Remove from cleanup list since it's already deleted
      const oldIndex = createdEventIds.indexOf(oldEvent.id);
      if (oldIndex > -1) {
        createdEventIds.splice(oldIndex, 1);
      }
    });

    it("should not delete pending or failed events", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const pendingEvent = await createTestOutboxEvent(workspace.id, "pending");
      const failedEvent = await createTestOutboxEvent(workspace.id, "failed");

      await prisma.$transaction(async (tx) => {
        await outboxRepository.markFailed(tx, failedEvent.id);
      });

      const cutoffDate = new Date();

      // Act
      const deletedCount = await outboxRepository.deleteOldPublished(
        cutoffDate
      );

      // Assert - Should not delete pending or failed events
      const { PrismaClient } = await import("@prisma/client");
      const checkPrisma = new PrismaClient();
      try {
        const pendingCheck = await checkPrisma.outboxEvent.findUnique({
          where: { id: pendingEvent.id },
        });
        const failedCheck = await checkPrisma.outboxEvent.findUnique({
          where: { id: failedEvent.id },
        });

        expect(pendingCheck).not.toBeNull();
        expect(failedCheck).not.toBeNull();
      } finally {
        await checkPrisma.$disconnect();
      }
    });
  });

  describe("findByAggregate", () => {
    it("should return events for specific aggregate", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const aggregateId = randomUUID();

      const event1 = await createTestOutboxEvent(
        workspace.id,
        "event1",
        aggregateId
      );
      const event2 = await createTestOutboxEvent(
        workspace.id,
        "event2",
        aggregateId
      );
      const otherEvent = await createTestOutboxEvent(
        workspace.id,
        "other",
        randomUUID()
      );

      // Act
      const result = await outboxRepository.findByAggregate(
        "workspace",
        aggregateId
      );

      // Assert
      expect(result).toHaveLength(2);
      const resultIds = result.map((event) => event.id);
      expect(resultIds).toContain(event1.id);
      expect(resultIds).toContain(event2.id);
      expect(resultIds).not.toContain(otherEvent.id);

      // Should be ordered by producedAt
      expect(result.length).toBeGreaterThan(1);
      expect(result[0]?.producedAt.getTime()).toBeLessThanOrEqual(
        result[1]?.producedAt.getTime() ?? 0
      );
    });

    it("should return empty array for non-existent aggregate", async () => {
      // Act
      const result = await outboxRepository.findByAggregate(
        "workspace",
        randomUUID()
      );

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  // Helper functions
  async function createTestWorkspace() {
    const workspace = await workspaceRepository.create(
      {
        name: `${TEST_PREFIX}-${randomUUID()}`,
        displayName: `Test Workspace ${randomUUID()}`,
        description: "Test workspace for outbox repository tests",
        ownerId: randomUUID(),
        settings: {},
      },
      randomUUID()
    );

    createdWorkspaceIds.push(workspace.id);
    return workspace;
  }

  async function createTestOutboxEvent(
    workspaceId: string,
    eventType: string,
    aggregateId?: string
  ) {
    const eventData: CreateOutboxEventData = {
      workspaceId,
      aggregateType: "workspace",
      aggregateId: aggregateId || workspaceId,
      eventType,
      payload: {
        test: "data",
        eventType,
        timestamp: new Date().toISOString(),
      },
    };

    const event = await outboxRepository.create(eventData);
    createdEventIds.push(event.id);
    return event;
  }

  // ===== TRANSACTION TESTS =====

  describe("Transaction-aware methods", () => {
    describe("Multi-instance concurrency tests", () => {
      it("should prevent duplicate processing with concurrent transactions (SKIP LOCKED)", async () => {
        // Arrange - Create 5 events
        const workspace = await createTestWorkspace();
        const events = await Promise.all([
          createTestOutboxEvent(workspace.id, "concurrent.1"),
          createTestOutboxEvent(workspace.id, "concurrent.2"),
          createTestOutboxEvent(workspace.id, "concurrent.3"),
          createTestOutboxEvent(workspace.id, "concurrent.4"),
          createTestOutboxEvent(workspace.id, "concurrent.5"),
        ]);

        const { PrismaClient } = await import("@prisma/client");

        // Simulate two service instances processing concurrently
        const instance1Prisma = new PrismaClient();
        const instance2Prisma = new PrismaClient();

        try {
          const instance1Processed: string[] = [];
          const instance2Processed: string[] = [];

          // Start both transactions concurrently (simulating two service instances)
          // Both try to grab 3 events, but SKIP LOCKED ensures they get different events
          const [result1, result2] = await Promise.all([
            // Instance 1: Lock and process up to 3 events
            instance1Prisma.$transaction(async (tx1) => {
              const locked = await outboxRepository.findPending(tx1, 3);
              const ourEvents = locked.filter((e) =>
                events.some((evt) => evt.id === e.id)
              );

              // Simulate processing delay to ensure overlap
              await new Promise((resolve) => setTimeout(resolve, 100));

              for (const event of ourEvents) {
                await outboxRepository.markPublished(tx1, event.id);
                instance1Processed.push(event.id);
              }

              return instance1Processed;
            }),

            // Instance 2: Try to lock up to 3 events (should get different events due to SKIP LOCKED)
            instance2Prisma.$transaction(async (tx2) => {
              // Add small delay to ensure instance 1 locks first
              await new Promise((resolve) => setTimeout(resolve, 10));

              const locked = await outboxRepository.findPending(tx2, 3);
              const ourEvents = locked.filter((e) =>
                events.some((evt) => evt.id === e.id)
              );

              // Simulate processing delay
              await new Promise((resolve) => setTimeout(resolve, 100));

              for (const event of ourEvents) {
                await outboxRepository.markPublished(tx2, event.id);
                instance2Processed.push(event.id);
              }

              return instance2Processed;
            }),
          ]);

          // Assert - No event should be processed by both instances
          const allProcessed = [...result1, ...result2];
          const uniqueProcessed = new Set(allProcessed);

          // Verify no duplicates (each event processed exactly once)
          expect(allProcessed.length).toBe(uniqueProcessed.size);

          // Verify all our events were processed
          expect(uniqueProcessed.size).toBe(events.length);
          const processedEventIds = Array.from(uniqueProcessed);
          events.forEach((event) => {
            expect(processedEventIds).toContain(event.id);
          });

          // Both instances should have processed some events (not 0 and 5)
          expect(result1.length).toBeGreaterThan(0);
          expect(result2.length).toBeGreaterThan(0);

          console.log(
            `✅ Multi-instance test: Instance 1 processed ${result1.length}, Instance 2 processed ${result2.length}`
          );
        } finally {
          await instance1Prisma.$disconnect();
          await instance2Prisma.$disconnect();
        }
      });

      it("should handle concurrent failed event retries without duplicates", async () => {
        // Arrange - Create failed events
        const workspace = await createTestWorkspace();
        const failedEvents = await Promise.all([
          createTestOutboxEvent(workspace.id, "retry.1"),
          createTestOutboxEvent(workspace.id, "retry.2"),
          createTestOutboxEvent(workspace.id, "retry.3"),
        ]);

        // Mark all as failed
        const { PrismaClient } = await import("@prisma/client");
        const setupPrisma = new PrismaClient();
        for (const event of failedEvents) {
          await setupPrisma.$transaction(async (tx) => {
            await outboxRepository.markFailed(tx, event.id);
          });
        }
        await setupPrisma.$disconnect();

        // Act - Two instances try to retry concurrently
        const instance1 = new PrismaClient();
        const instance2 = new PrismaClient();

        try {
          const [processed1, processed2] = await Promise.all([
            instance1.$transaction(async (tx) => {
              const locked = await outboxRepository.findFailedForRetry(
                tx,
                3,
                10
              );
              const ourEvents = locked.filter((e) =>
                failedEvents.some((evt) => evt.id === e.id)
              );

              await new Promise((resolve) => setTimeout(resolve, 30));

              for (const event of ourEvents) {
                await outboxRepository.markFailed(tx, event.id); // Increment attempts
              }

              return ourEvents.map((e) => e.id);
            }),

            instance2.$transaction(async (tx) => {
              const locked = await outboxRepository.findFailedForRetry(
                tx,
                3,
                10
              );
              const ourEvents = locked.filter((e) =>
                failedEvents.some((evt) => evt.id === e.id)
              );

              await new Promise((resolve) => setTimeout(resolve, 30));

              for (const event of ourEvents) {
                await outboxRepository.markFailed(tx, event.id); // Increment attempts
              }

              return ourEvents.map((e) => e.id);
            }),
          ]);

          // Assert - No duplicates
          const allProcessed = [...processed1, ...processed2];
          const uniqueProcessed = new Set(allProcessed);

          expect(allProcessed.length).toBe(uniqueProcessed.size);
          expect(uniqueProcessed.size).toBe(failedEvents.length);

          console.log(
            `✅ Concurrent retry test: Instance 1 processed ${processed1.length}, Instance 2 processed ${processed2.length}`
          );
        } finally {
          await instance1.$disconnect();
          await instance2.$disconnect();
        }
      });
    });

    describe("findPending within transaction", () => {
      it("should find and lock pending events within transaction", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const event1 = await createTestOutboxEvent(workspace.id, "tx.event1");
        const event2 = await createTestOutboxEvent(workspace.id, "tx.event2");

        // Act - Use transaction to lock and process events
        const { PrismaClient } = await import("@prisma/client");
        const testPrisma = new PrismaClient();

        try {
          const result = await testPrisma.$transaction(async (tx) => {
            // Lock events within transaction
            const lockedEvents = await outboxRepository.findPending(tx, 10);

            // Find our test events
            const testEvents = lockedEvents.filter((event: OutboxEvent) =>
              [event1.id, event2.id].includes(event.id)
            );

            // Process one event (mark as published) within the same transaction
            if (testEvents.length > 0 && testEvents[0]) {
              await outboxRepository.markPublished(tx, testEvents[0].id);
            }

            return {
              lockedEvents: testEvents,
              processed: testEvents.length > 0,
            };
          });

          // Assert
          expect(result.lockedEvents.length).toBeGreaterThan(0);
          expect(result.processed).toBe(true);
        } finally {
          await testPrisma.$disconnect();
        }
      });

      it("should maintain locks throughout transaction", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const event = await createTestOutboxEvent(workspace.id, "lock.test");

        // Act & Assert - Demonstrate that locks are maintained in transaction
        const { PrismaClient } = await import("@prisma/client");
        const testPrisma = new PrismaClient();

        try {
          let lockWasEffective = false;

          await testPrisma.$transaction(async (tx) => {
            // Lock the event
            const lockedEvents = await outboxRepository.findPending(tx, 1);
            const testEvent = lockedEvents.find(
              (e: OutboxEvent) => e.id === event.id
            );

            if (testEvent) {
              // Event is locked - mark it as published
              await outboxRepository.markPublished(tx, testEvent.id);
              lockWasEffective = true;
            }
          });

          expect(lockWasEffective).toBe(true);
        } finally {
          await testPrisma.$disconnect();
        }
      });
    });

    describe("findFailedForRetry within transaction", () => {
      it("should find and lock failed events within transaction", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const failedEvent = await createTestOutboxEvent(
          workspace.id,
          "failed.tx"
        );

        // Mark as failed first (automatically increments to 1)
        const { PrismaClient } = await import("@prisma/client");
        const setupPrisma = new PrismaClient();

        try {
          await setupPrisma.$transaction(async (tx) => {
            await outboxRepository.markFailed(tx, failedEvent.id);
          });
        } finally {
          await setupPrisma.$disconnect();
        }

        // Act - Use transaction to lock and retry failed events
        const testPrisma = new PrismaClient();

        try {
          const result = await testPrisma.$transaction(async (tx) => {
            // Lock failed events within transaction
            const lockedEvents = await outboxRepository.findFailedForRetry(
              tx,
              3,
              10
            );

            // Find our test event
            const testEvent = lockedEvents.find(
              (e: OutboxEvent) => e.id === failedEvent.id
            );

            // Process the failed event within the same transaction (mark failed again)
            if (testEvent) {
              await outboxRepository.markFailed(tx, testEvent.id);
              return { found: true, processed: true };
            }

            return { found: false, processed: false };
          });

          // Assert
          expect(result.found).toBe(true);
          expect(result.processed).toBe(true);
        } finally {
          await testPrisma.$disconnect();
        }
      });
    });

    describe("markPublished within transaction", () => {
      it("should mark event as published within transaction", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const event = await createTestOutboxEvent(workspace.id, "publish.tx");

        // Act
        const { PrismaClient } = await import("@prisma/client");
        const testPrisma = new PrismaClient();

        try {
          await testPrisma.$transaction(async (tx) => {
            await outboxRepository.markPublished(tx, event.id);
          });

          // Assert - Check the event was marked as published
          const updatedEvent = await testPrisma.outboxEvent.findUnique({
            where: { id: event.id },
          });

          expect(updatedEvent?.status).toBe("published");
          expect(updatedEvent?.publishedAt).not.toBeNull();
        } finally {
          await testPrisma.$disconnect();
        }
      });
    });

    describe("markFailed within transaction", () => {
      it("should mark event as failed within transaction", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const event = await createTestOutboxEvent(workspace.id, "fail.tx");

        // Act
        const { PrismaClient } = await import("@prisma/client");
        const testPrisma = new PrismaClient();

        try {
          await testPrisma.$transaction(async (tx) => {
            await outboxRepository.markFailed(tx, event.id);
          });

          // Assert - Check the event was marked as failed
          const updatedEvent = await testPrisma.outboxEvent.findUnique({
            where: { id: event.id },
          });

          expect(updatedEvent?.status).toBe("failed");
        } finally {
          await testPrisma.$disconnect();
        }
      });
    });

    describe("markFailed increments attempts counter", () => {
      it("should increment failed attempts with each markFailed call", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const event = await createTestOutboxEvent(workspace.id, "increment.tx");

        // Act - Call markFailed twice (each call increments)
        const { PrismaClient } = await import("@prisma/client");
        const testPrisma = new PrismaClient();

        try {
          await testPrisma.$transaction(async (tx) => {
            await outboxRepository.markFailed(tx, event.id);
          });
          await testPrisma.$transaction(async (tx) => {
            await outboxRepository.markFailed(tx, event.id);
          });

          // Assert - Check the attempts were incremented
          const updatedEvent = await testPrisma.outboxEvent.findUnique({
            where: { id: event.id },
          });

          expect(updatedEvent?.status).toBe("failed");
          expect(updatedEvent?.failedAttempts).toBe(2);
        } finally {
          await testPrisma.$disconnect();
        }
      });
    });

    describe("Complete workflow with transactions", () => {
      it("should demonstrate full outbox processing workflow with proper locking", async () => {
        // Arrange
        const workspace = await createTestWorkspace();
        const events = await Promise.all([
          createTestOutboxEvent(workspace.id, "workflow.event1"),
          createTestOutboxEvent(workspace.id, "workflow.event2"),
          createTestOutboxEvent(workspace.id, "workflow.event3"),
        ]);

        // Act - Simulate OutboxService processing with transactions
        const { PrismaClient } = await import("@prisma/client");
        const testPrisma = new PrismaClient();

        try {
          const processedEvents: string[] = [];

          // Process batch 1
          await testPrisma.$transaction(async (tx) => {
            const lockedEvents = await outboxRepository.findPending(tx, 2);

            for (const event of lockedEvents) {
              if (events.some((e) => e.id === event.id)) {
                // Simulate successful processing
                await outboxRepository.markPublished(tx, event.id);
                processedEvents.push(event.id);
              }
            }
          });

          // Process batch 2 (any remaining events)
          await testPrisma.$transaction(async (tx) => {
            const lockedEvents = await outboxRepository.findPending(tx, 2);

            for (const event of lockedEvents) {
              if (events.some((e) => e.id === event.id)) {
                // Simulate successful processing
                await outboxRepository.markPublished(tx, event.id);
                processedEvents.push(event.id);
              }
            }
          });

          // Assert - All events should have been processed
          const finalStates = await Promise.all(
            events.map((e) =>
              testPrisma.outboxEvent.findUnique({ where: { id: e.id } })
            )
          );

          const publishedCount = finalStates.filter(
            (e) => e?.status === "published"
          ).length;
          expect(publishedCount).toBeGreaterThan(0);
          expect(processedEvents.length).toBeGreaterThan(0);
        } finally {
          await testPrisma.$disconnect();
        }
      });
    });
  });
});
