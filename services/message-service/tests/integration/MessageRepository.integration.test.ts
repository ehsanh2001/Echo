import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { MessageRepository } from "../../src/repositories/MessageRepository";
import { IMessageRepository } from "../../src/interfaces/repositories/IMessageRepository";
import { CreateMessageData } from "../../src/types";
import { MessageServiceError } from "../../src/utils/errors";
import { container } from "../../src/container"; // Auto-configured container
import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";

// Type assertion to avoid Prisma client typing issues during development
const prismaClientWithModels = (client: PrismaClient) => client as any;

// Helper function to create test UUIDs
const createTestUUID = () => randomUUID();

describe("MessageRepository Integration Tests", () => {
  let prisma: PrismaClient;
  let messageRepository: IMessageRepository;

  beforeAll(async () => {
    // Use container to resolve both PrismaClient and MessageRepository with automatic DI
    prisma = container.resolve(PrismaClient);
    messageRepository =
      container.resolve<IMessageRepository>("IMessageRepository");
  });

  afterEach(async () => {
    // Clean up test data after each test to ensure clean state for next test
    // Since integration tests run sequentially, we can safely delete all records
    const db = prismaClientWithModels(prisma);

    // Clean up in reverse dependency order
    await db.messageReaction.deleteMany({});
    await db.messageMention.deleteMany({});
    await db.messageAttachment.deleteMany({});
    await db.message.deleteMany({});
    await db.channelSequence.deleteMany({});
  });

  describe("create message functionality", () => {
    it("should create a message successfully with valid data", async () => {
      const validMessageData: CreateMessageData = {
        workspaceId: createTestUUID(),
        channelId: createTestUUID(),
        userId: createTestUUID(),
        content: "Hello, this is a test message!",
      };

      const result = await messageRepository.create(validMessageData);

      expect(result).toMatchObject({
        workspaceId: validMessageData.workspaceId,
        channelId: validMessageData.channelId,
        userId: validMessageData.userId,
        content: validMessageData.content,
        contentType: "text",
        isEdited: false,
        editCount: 0,
        deliveryStatus: "sent",
        parentMessageId: null,
        threadRootId: null,
        threadDepth: 0,
      });
      expect(result.id).toBeDefined();
      expect(result.messageNo).toBe(1); // First message in channel should be 1
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(typeof result.messageNo).toBe("number"); // Should be converted from bigint
    });

    it("should create messages with sequential message numbers in same channel", async () => {
      const workspaceId = createTestUUID();
      const channelId = createTestUUID();
      const userId = createTestUUID();

      const messageData1: CreateMessageData = {
        workspaceId,
        channelId,
        userId,
        content: "First message",
      };

      const messageData2: CreateMessageData = {
        workspaceId,
        channelId,
        userId,
        content: "Second message",
      };

      const messageData3: CreateMessageData = {
        workspaceId,
        channelId,
        userId,
        content: "Third message",
      };

      const result1 = await messageRepository.create(messageData1);
      const result2 = await messageRepository.create(messageData2);
      const result3 = await messageRepository.create(messageData3);

      expect(result1.messageNo).toBe(1);
      expect(result2.messageNo).toBe(2);
      expect(result3.messageNo).toBe(3);
      expect(result1.content).toBe("First message");
      expect(result2.content).toBe("Second message");
      expect(result3.content).toBe("Third message");
    });

    it("should create messages with independent sequences for different channels", async () => {
      const workspaceId = createTestUUID();
      const channelId1 = createTestUUID();
      const channelId2 = createTestUUID();
      const userId = createTestUUID();

      const messageData1: CreateMessageData = {
        workspaceId,
        channelId: channelId1,
        userId,
        content: "First message in channel 1",
      };

      const messageData2: CreateMessageData = {
        workspaceId,
        channelId: channelId2,
        userId,
        content: "First message in channel 2",
      };

      const messageData3: CreateMessageData = {
        workspaceId,
        channelId: channelId1,
        userId,
        content: "Second message in channel 1",
      };

      const result1 = await messageRepository.create(messageData1);
      const result2 = await messageRepository.create(messageData2);
      const result3 = await messageRepository.create(messageData3);

      // Each channel should have independent sequences starting from 1
      expect(result1.messageNo).toBe(1); // First in channel 1
      expect(result2.messageNo).toBe(1); // First in channel 2
      expect(result3.messageNo).toBe(2); // Second in channel 1
    });

    it("should create message with optional fields", async () => {
      const optionalMessageData: CreateMessageData = {
        workspaceId: createTestUUID(),
        channelId: createTestUUID(),
        userId: createTestUUID(),
        content: "Message with optional fields",
        contentType: "markdown",
        parentMessageId: randomUUID(),
        threadRootId: randomUUID(),
        threadDepth: 2,
      };

      const result = await messageRepository.create(optionalMessageData);

      expect(result).toMatchObject({
        content: optionalMessageData.content,
        contentType: "markdown",
        parentMessageId: optionalMessageData.parentMessageId,
        threadRootId: optionalMessageData.threadRootId,
        threadDepth: 2,
      });
      expect(result.messageNo).toBe(1);
    });

    it("should handle concurrent message creation in same channel atomically", async () => {
      const workspaceId = createTestUUID();
      const channelId = createTestUUID();

      // Create multiple messages concurrently
      const promises = Array.from({ length: 5 }, (_, index) => {
        const messageData: CreateMessageData = {
          workspaceId,
          channelId,
          userId: createTestUUID(),
          content: `Concurrent message ${index + 1}`,
        };
        return messageRepository.create(messageData);
      });

      const results = await Promise.all(promises);
      const messageNumbers = results
        .map((r) => r.messageNo)
        .sort((a, b) => a - b);

      // Should have sequential numbers from 1 to 5
      expect(messageNumbers).toEqual([1, 2, 3, 4, 5]);

      // All messages should be created
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.id).toBeDefined();
        expect(result.workspaceId).toBe(workspaceId);
        expect(result.channelId).toBe(channelId);
      });
    });
  });

  describe("message number generation", () => {
    it("should create channel sequence record automatically", async () => {
      const workspaceId = createTestUUID();
      const channelId = createTestUUID();
      const userId = createTestUUID();

      const messageData: CreateMessageData = {
        workspaceId,
        channelId,
        userId,
        content: "Test message for sequence creation",
      };

      await messageRepository.create(messageData);

      // Check if channel sequence record was created
      const db = prismaClientWithModels(prisma);
      const channelSequence = await db.channelSequence.findUnique({
        where: {
          workspaceId_channelId: {
            workspaceId,
            channelId,
          },
        },
      });

      expect(channelSequence).toBeDefined();
      expect(channelSequence.lastMessageNo).toBe(1n); // Should be bigint in DB
      expect(channelSequence.workspaceId).toBe(workspaceId);
      expect(channelSequence.channelId).toBe(channelId);
    });
  });

  describe("error handling", () => {
    it("should throw MessageServiceError for invalid UUID format", async () => {
      const messageData: CreateMessageData = {
        workspaceId: "invalid-uuid-format",
        channelId: createTestUUID(),
        userId: createTestUUID(),
        content: "Test message",
      };

      await expect(messageRepository.create(messageData)).rejects.toThrow(
        MessageServiceError
      );
    });

    it("should throw MessageServiceError and log details for database errors", async () => {
      // Spy on console.error to verify logging
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const messageData: CreateMessageData = {
        workspaceId: "invalid-uuid-format",
        channelId: createTestUUID(),
        userId: createTestUUID(),
        content: "Test message",
      };

      try {
        await messageRepository.create(messageData);
        fail("Expected MessageServiceError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MessageServiceError);
        expect((error as MessageServiceError).code).toBe("DATABASE_ERROR");
        expect((error as MessageServiceError).statusCode).toBe(500);
        expect((error as MessageServiceError).message).toContain(
          "internal error"
        );

        // Verify that error was logged
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Database error in"),
          expect.objectContaining({
            workspaceId: "invalid-uuid-format",
            error: expect.any(String),
          })
        );
      }

      consoleSpy.mockRestore();
    });

    it("should handle empty content gracefully", async () => {
      const messageData: CreateMessageData = {
        workspaceId: createTestUUID(),
        channelId: createTestUUID(),
        userId: createTestUUID(),
        content: "", // Empty content
      };

      // Should create message with empty content (business logic validation is in service layer)
      const result = await messageRepository.create(messageData);
      expect(result.content).toBe("");
      expect(result.messageNo).toBe(1);
    });
  });

  describe("data integrity", () => {
    it("should maintain composite primary key uniqueness", async () => {
      const workspaceId = createTestUUID();
      const channelId = createTestUUID();
      const userId = createTestUUID();

      // Create first message
      const messageData1: CreateMessageData = {
        workspaceId,
        channelId,
        userId,
        content: "First message",
      };

      const result1 = await messageRepository.create(messageData1);
      expect(result1.messageNo).toBe(1);

      // Try to manually insert a message with the same composite key using Prisma directly
      // This should fail due to unique constraint
      const db = prismaClientWithModels(prisma);

      await expect(
        db.message.create({
          data: {
            workspaceId,
            channelId,
            messageNo: 1n, // Same message number
            userId,
            content: "Duplicate message",
            contentType: "text",
            deliveryStatus: "sent",
          },
        })
      ).rejects.toThrow();
    });

    it("should preserve message creation timestamps", async () => {
      const beforeCreate = new Date();

      const messageData: CreateMessageData = {
        workspaceId: createTestUUID(),
        channelId: createTestUUID(),
        userId: createTestUUID(),
        content: "Timestamp test message",
      };

      const result = await messageRepository.create(messageData);
      const afterCreate = new Date();

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      // Allow for small timing variations (within 100ms is reasonable)
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime() + 100
      );
      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
        result.createdAt.getTime()
      );
    });
  });
});
