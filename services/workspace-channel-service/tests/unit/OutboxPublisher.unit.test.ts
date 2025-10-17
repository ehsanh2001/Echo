import "reflect-metadata";
import { OutboxPublisher } from "../../src/workers/OutboxPublisher";
import { IOutboxRepository } from "../../src/interfaces/repositories/IOutboxRepository";
import { IRabbitMQService } from "../../src/interfaces/services/IRabbitMQService";
import { PrismaClient, OutboxEvent, OutboxStatus } from "@prisma/client";

// Mock config
jest.mock("../../src/config/env", () => ({
  config: {
    worker: {
      pollIntervalMs: 100, // Fast polling for tests
      batchSize: 5,
      maxRetries: 3,
      retryDelayMs: 100,
      shutdownTimeoutMs: 1000,
    },
  },
}));

describe("OutboxPublisher - Unit Tests", () => {
  let outboxPublisher: OutboxPublisher;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let mockRabbitMQService: jest.Mocked<IRabbitMQService>;
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let mockTransaction: jest.Mock;

  // Helper to create mock outbox events
  const createMockEvent = (
    id: string,
    eventType: string = "workspace.invite.created"
  ): OutboxEvent => ({
    id,
    workspaceId: "workspace-1",
    channelId: null,
    aggregateType: "workspace",
    aggregateId: "workspace-1",
    eventType,
    payload: {
      eventId: id,
      eventType,
      aggregateType: "workspace",
      aggregateId: "workspace-1",
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        inviteId: "invite-1",
        workspaceId: "workspace-1",
        email: "test@example.com",
      },
      metadata: {
        source: "workspace-channel-service",
      },
    },
    producedAt: new Date(),
    publishedAt: null,
    failedAttempts: 0,
    status: "pending" as OutboxStatus,
  });

  beforeEach(() => {
    // Create mocks
    mockOutboxRepository = {
      create: jest.fn(),
      findPending: jest.fn(),
      findFailedForRetry: jest.fn(),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    } as any;

    mockRabbitMQService = {
      connect: jest.fn(),
      publish: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    // Mock transaction
    mockTransaction = jest.fn();
    mockPrismaClient = {
      $transaction: mockTransaction,
    } as any;

    // Create instance
    outboxPublisher = new OutboxPublisher(
      mockOutboxRepository,
      mockRabbitMQService,
      mockPrismaClient
    );
  });

  afterEach(async () => {
    // Stop worker if running
    if (outboxPublisher.isRunning()) {
      await outboxPublisher.stop();
    }

    jest.clearAllMocks();
  });

  describe("start()", () => {
    it("should start the worker and set running to true", async () => {
      await outboxPublisher.start();

      expect(outboxPublisher.isRunning()).toBe(true);

      await outboxPublisher.stop();
    });

    it("should not start if already running", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await outboxPublisher.start();
      await outboxPublisher.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("already running")
      );

      consoleSpy.mockRestore();
      await outboxPublisher.stop();
    });

    it("should start polling for events", async () => {
      // Setup: transaction returns empty array (no events)
      mockTransaction.mockImplementation(async (callback) => {
        return await callback({});
      });
      mockOutboxRepository.findPending.mockResolvedValue([]);

      await outboxPublisher.start();

      // Wait a bit for poll to execute
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockTransaction).toHaveBeenCalled();

      await outboxPublisher.stop();
    });
  });

  describe("stop()", () => {
    it("should stop the worker and set running to false", async () => {
      await outboxPublisher.start();
      await outboxPublisher.stop();

      expect(outboxPublisher.isRunning()).toBe(false);
    });

    it("should disconnect from RabbitMQ", async () => {
      await outboxPublisher.start();
      await outboxPublisher.stop();

      expect(mockRabbitMQService.disconnect).toHaveBeenCalled();
    });

    it("should not stop if not running", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await outboxPublisher.stop();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not running")
      );

      consoleSpy.mockRestore();
    });

    it("should wait for current batch to complete", async () => {
      // Setup: slow transaction to simulate processing
      mockTransaction.mockImplementation(async (callback) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return await callback({});
      });
      mockOutboxRepository.findPending.mockResolvedValue([]);

      await outboxPublisher.start();

      // Wait a bit to ensure batch processing started
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stopPromise = outboxPublisher.stop();

      // Stop should wait for batch to complete
      await stopPromise;

      expect(mockRabbitMQService.disconnect).toHaveBeenCalled();
    });
  });

  describe("processBatch()", () => {
    it("should process pending events successfully", async () => {
      const mockEvents = [
        createMockEvent("event-1"),
        createMockEvent("event-2"),
      ];

      // Setup transaction mock to return events once, then empty
      let callCount = 0;
      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockEvents : []);
      });

      mockRabbitMQService.publish.mockResolvedValue(undefined);
      mockOutboxRepository.markPublished.mockResolvedValue(undefined);

      await outboxPublisher.start();

      // Wait for batch to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      expect(mockRabbitMQService.publish).toHaveBeenCalledTimes(2);
      expect(mockOutboxRepository.markPublished).toHaveBeenCalledTimes(2);
    });

    it("should handle empty batch (no events)", async () => {
      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockResolvedValue([]);

      await outboxPublisher.start();

      // Wait for poll cycle
      await new Promise((resolve) => setTimeout(resolve, 150));

      await outboxPublisher.stop();

      expect(mockOutboxRepository.findPending).toHaveBeenCalled();
      expect(mockRabbitMQService.publish).not.toHaveBeenCalled();
      expect(mockOutboxRepository.markPublished).not.toHaveBeenCalled();
    });

    it("should continue processing other events if one fails", async () => {
      const mockEvents = [
        createMockEvent("event-1"),
        createMockEvent("event-2"),
        createMockEvent("event-3"),
      ];

      let callCount = 0;
      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockEvents : []);
      });

      // Second event fails to publish
      mockRabbitMQService.publish
        .mockResolvedValueOnce(undefined) // event-1 succeeds
        .mockRejectedValueOnce(new Error("Network error")) // event-2 fails
        .mockResolvedValueOnce(undefined); // event-3 succeeds

      mockOutboxRepository.markPublished.mockResolvedValue(undefined);
      mockOutboxRepository.markFailed.mockResolvedValue(undefined);

      await outboxPublisher.start();

      // Wait for batch to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      expect(mockRabbitMQService.publish).toHaveBeenCalledTimes(3);
      expect(mockOutboxRepository.markPublished).toHaveBeenCalledTimes(2); // event-1 and event-3
      expect(mockOutboxRepository.markFailed).toHaveBeenCalledTimes(1); // event-2
    });

    it("should use correct routing key format", async () => {
      const mockEvent = createMockEvent("event-1", "workspace.invite.created");

      let callCount = 0;
      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? [mockEvent] : []);
      });

      mockRabbitMQService.publish.mockResolvedValue(undefined);
      mockOutboxRepository.markPublished.mockResolvedValue(undefined);

      await outboxPublisher.start();

      // Wait for batch to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      // Routing key should be just the eventType
      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        "workspace.invite.created",
        mockEvent.payload
      );
    });

    it("should publish complete event payload", async () => {
      const mockEvent = createMockEvent("event-1");

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockResolvedValue([mockEvent]);
      mockRabbitMQService.publish.mockResolvedValue(undefined);
      mockOutboxRepository.markPublished.mockResolvedValue(undefined);

      await outboxPublisher.start();

      // Wait for batch to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        expect.any(String),
        mockEvent.payload
      );

      // Verify payload structure
      const publishedPayload = mockRabbitMQService.publish.mock.calls[0]?.[1];
      expect(publishedPayload).toBeDefined();
      expect(publishedPayload).toHaveProperty("eventId");
      expect(publishedPayload).toHaveProperty("eventType");
      expect(publishedPayload).toHaveProperty("aggregateType");
      expect(publishedPayload).toHaveProperty("data");
      expect(publishedPayload).toHaveProperty("metadata");
    });
  });

  describe("transaction handling", () => {
    it("should fetch and process events in single transaction", async () => {
      const mockEvents = [createMockEvent("event-1")];
      let transactionCallback: any;

      mockTransaction.mockImplementation(async (callback) => {
        transactionCallback = callback;
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockResolvedValue(mockEvents);
      mockRabbitMQService.publish.mockResolvedValue(undefined);
      mockOutboxRepository.markPublished.mockResolvedValue(undefined);

      await outboxPublisher.start();

      // Wait for batch to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();

      // Verify operations used the transaction context
      expect(mockOutboxRepository.findPending).toHaveBeenCalledWith(
        mockOutboxRepository,
        5 // batch size
      );
      expect(mockOutboxRepository.markPublished).toHaveBeenCalledWith(
        mockOutboxRepository,
        "event-1"
      );
    });

    it("should mark event as failed in same transaction if publish fails", async () => {
      const mockEvent = createMockEvent("event-1");

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockOutboxRepository);
      });

      mockOutboxRepository.findPending.mockResolvedValue([mockEvent]);
      mockRabbitMQService.publish.mockRejectedValue(
        new Error("RabbitMQ error")
      );
      mockOutboxRepository.markFailed.mockResolvedValue(undefined);

      await outboxPublisher.start();

      // Wait for batch to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      expect(mockOutboxRepository.markFailed).toHaveBeenCalledWith(
        mockOutboxRepository,
        "event-1"
      );
    });
  });

  describe("error handling", () => {
    it("should handle transaction errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockTransaction.mockRejectedValue(new Error("Database error"));

      await outboxPublisher.start();

      // Wait for poll cycle
      await new Promise((resolve) => setTimeout(resolve, 200));

      await outboxPublisher.stop();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error processing batch"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should continue polling after batch error", async () => {
      mockTransaction
        .mockRejectedValueOnce(new Error("First error"))
        .mockImplementation(async (callback) => {
          return await callback(mockOutboxRepository);
        });

      mockOutboxRepository.findPending.mockResolvedValue([]);

      await outboxPublisher.start();

      // Wait for multiple poll cycles
      await new Promise((resolve) => setTimeout(resolve, 300));

      await outboxPublisher.stop();

      // Should have attempted multiple polls despite first error
      expect(mockTransaction.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe("isRunning()", () => {
    it("should return false when not started", () => {
      expect(outboxPublisher.isRunning()).toBe(false);
    });

    it("should return true when started", async () => {
      await outboxPublisher.start();
      expect(outboxPublisher.isRunning()).toBe(true);
      await outboxPublisher.stop();
    });

    it("should return false after stopped", async () => {
      await outboxPublisher.start();
      await outboxPublisher.stop();
      expect(outboxPublisher.isRunning()).toBe(false);
    });
  });
});
