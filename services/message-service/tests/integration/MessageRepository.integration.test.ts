import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { MessageRepository } from "../../src/repositories/MessageRepository";
import { IMessageRepository } from "../../src/interfaces/repositories/IMessageRepository";
import {
  CreateMessageData,
  MessageResponse,
  PaginationDirection,
} from "../../src/types";
import { MessageServiceError } from "../../src/utils/errors";
import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";

// Type assertion to avoid Prisma client typing issues during development
const prismaClientWithModels = (client: PrismaClient) => client as any;

// Helper function to create test UUIDs
const createTestUUID = () => randomUUID();

// Helper to safely access array elements (used after length check)
const at = <T>(arr: T[], index: number): T => arr[index]!;

describe("MessageRepository Integration Tests", () => {
  let prisma: PrismaClient;
  let messageRepository: IMessageRepository;

  beforeAll(async () => {
    // Create PrismaClient and MessageRepository directly for simpler test setup
    // This avoids importing the full container which includes controllers
    prisma = new PrismaClient();
    messageRepository = new MessageRepository(prisma);
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

  describe("cursor-based pagination", () => {
    // Helper to seed messages for pagination tests
    const seedMessagesForPagination = async (
      workspaceId: string,
      channelId: string,
      count: number
    ) => {
      const userId = createTestUUID();
      const messages = [];

      for (let i = 1; i <= count; i++) {
        const messageData: CreateMessageData = {
          workspaceId,
          channelId,
          userId,
          content: `Message ${i}`,
        };
        const message = await messageRepository.create(messageData);
        messages.push(message);
      }

      return messages;
    };

    describe("getMessagesWithCursor - before direction", () => {
      it("should retrieve messages before a cursor in descending order", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 10 messages (messageNo: 1-10)
        await seedMessagesForPagination(workspaceId, channelId, 10);

        // Get messages before messageNo 8 (should return 7, 6, 5, 4, 3)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          8,
          5,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(5);
        expect(at(results, 0).messageNo).toBe(7);
        expect(at(results, 1).messageNo).toBe(6);
        expect(at(results, 2).messageNo).toBe(5);
        expect(at(results, 3).messageNo).toBe(4);
        expect(at(results, 4).messageNo).toBe(3);
        expect(at(results, 0).content).toBe("Message 7");
        expect(at(results, 4).content).toBe("Message 3");
      });

      it("should return empty array when cursor is at the beginning", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 5 messages
        await seedMessagesForPagination(workspaceId, channelId, 5);

        // Get messages before messageNo 1 (should return empty)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          1,
          10,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(0);
      });

      it("should respect the limit parameter", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 20 messages
        await seedMessagesForPagination(workspaceId, channelId, 20);

        // Get only 3 messages before messageNo 10
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          10,
          3,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(3);
        expect(at(results, 0).messageNo).toBe(9);
        expect(at(results, 1).messageNo).toBe(8);
        expect(at(results, 2).messageNo).toBe(7);
      });

      it("should return less than limit if not enough messages exist", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed only 5 messages
        await seedMessagesForPagination(workspaceId, channelId, 5);

        // Request 10 messages before messageNo 4 (only 3 exist: 3, 2, 1)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          4,
          10,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(3);
        expect(at(results, 0).messageNo).toBe(3);
        expect(at(results, 1).messageNo).toBe(2);
        expect(at(results, 2).messageNo).toBe(1);
      });

      it("should only return messages from the specified channel", async () => {
        const workspaceId = createTestUUID();
        const channelId1 = createTestUUID();
        const channelId2 = createTestUUID();

        // Seed messages in both channels
        await seedMessagesForPagination(workspaceId, channelId1, 5);
        await seedMessagesForPagination(workspaceId, channelId2, 5);

        // Get messages from channel1 only
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId1,
          6,
          10,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(5);
        // All results should be from channelId1
        results.forEach((message: MessageResponse) => {
          expect(message.channelId).toBe(channelId1);
        });
      });

      it("should handle cursor larger than max messageNo", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 5 messages (messageNo: 1-5)
        await seedMessagesForPagination(workspaceId, channelId, 5);

        // Get messages before messageNo 100 (should return all 5)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          100,
          10,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(5);
        expect(at(results, 0).messageNo).toBe(5);
        expect(at(results, 4).messageNo).toBe(1);
      });
    });

    describe("getMessagesWithCursor - after direction", () => {
      it("should retrieve messages after a cursor in ascending order", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 10 messages (messageNo: 1-10)
        await seedMessagesForPagination(workspaceId, channelId, 10);

        // Get messages after messageNo 3 (should return 4, 5, 6, 7, 8)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          3,
          5,
          PaginationDirection.AFTER
        );

        expect(results).toHaveLength(5);
        expect(at(results, 0).messageNo).toBe(4);
        expect(at(results, 1).messageNo).toBe(5);
        expect(at(results, 2).messageNo).toBe(6);
        expect(at(results, 3).messageNo).toBe(7);
        expect(at(results, 4).messageNo).toBe(8);
        expect(at(results, 0).content).toBe("Message 4");
        expect(at(results, 4).content).toBe("Message 8");
      });

      it("should return empty array when cursor is at the end", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 5 messages
        await seedMessagesForPagination(workspaceId, channelId, 5);

        // Get messages after messageNo 5 (should return empty)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          5,
          10,
          PaginationDirection.AFTER
        );

        expect(results).toHaveLength(0);
      });

      it("should respect the limit parameter", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 20 messages
        await seedMessagesForPagination(workspaceId, channelId, 20);

        // Get only 3 messages after messageNo 5
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          5,
          3,
          PaginationDirection.AFTER
        );

        expect(results).toHaveLength(3);
        expect(at(results, 0).messageNo).toBe(6);
        expect(at(results, 1).messageNo).toBe(7);
        expect(at(results, 2).messageNo).toBe(8);
      });

      it("should return less than limit if not enough messages exist", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed only 5 messages
        await seedMessagesForPagination(workspaceId, channelId, 5);

        // Request 10 messages after messageNo 3 (only 2 exist: 4, 5)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          3,
          10,
          PaginationDirection.AFTER
        );

        expect(results).toHaveLength(2);
        expect(at(results, 0).messageNo).toBe(4);
        expect(at(results, 1).messageNo).toBe(5);
      });

      it("should only return messages from the specified channel", async () => {
        const workspaceId = createTestUUID();
        const channelId1 = createTestUUID();
        const channelId2 = createTestUUID();

        // Seed messages in both channels
        await seedMessagesForPagination(workspaceId, channelId1, 5);
        await seedMessagesForPagination(workspaceId, channelId2, 5);

        // Get messages from channel1 only
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId1,
          0,
          10,
          PaginationDirection.AFTER
        );

        expect(results).toHaveLength(5);
        // All results should be from channelId1
        results.forEach((message: MessageResponse) => {
          expect(message.channelId).toBe(channelId1);
        });
      });

      it("should handle cursor smaller than min messageNo", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 5 messages (messageNo: 1-5)
        await seedMessagesForPagination(workspaceId, channelId, 5);

        // Get messages after messageNo 0 (should return all 5)
        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          0,
          10,
          PaginationDirection.AFTER
        );

        expect(results).toHaveLength(5);
        expect(at(results, 0).messageNo).toBe(1);
        expect(at(results, 4).messageNo).toBe(5);
      });
    });

    describe("pagination edge cases", () => {
      it("should handle pagination in empty channel", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // No messages seeded

        const resultsBefore = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          10,
          5,
          PaginationDirection.BEFORE
        );

        const resultsAfter = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          10,
          5,
          PaginationDirection.AFTER
        );

        expect(resultsBefore).toHaveLength(0);
        expect(resultsAfter).toHaveLength(0);
      });

      it("should work with limit of 1", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        await seedMessagesForPagination(workspaceId, channelId, 5);

        const resultsBefore = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          3,
          1,
          PaginationDirection.BEFORE
        );

        const resultsAfter = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          3,
          1,
          PaginationDirection.AFTER
        );

        expect(resultsBefore).toHaveLength(1);
        expect(at(resultsBefore, 0).messageNo).toBe(2);

        expect(resultsAfter).toHaveLength(1);
        expect(at(resultsAfter, 0).messageNo).toBe(4);
      });

      it("should handle very large limit values", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        await seedMessagesForPagination(workspaceId, channelId, 10);

        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          11,
          1000,
          PaginationDirection.BEFORE
        );

        // Should return all 10 messages even though limit is 1000
        expect(results).toHaveLength(10);
      });

      it("should maintain consistent results across multiple pagination calls", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 30 messages
        await seedMessagesForPagination(workspaceId, channelId, 30);

        // Paginate backwards from message 31 in chunks of 10
        const page1 = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          31,
          10,
          PaginationDirection.BEFORE
        );
        const page2 = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          at(page1, page1.length - 1).messageNo,
          10,
          PaginationDirection.BEFORE
        );
        const page3 = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          at(page2, page2.length - 1).messageNo,
          10,
          PaginationDirection.BEFORE
        );

        // Verify we got all 30 messages across 3 pages
        expect(page1).toHaveLength(10);
        expect(page2).toHaveLength(10);
        expect(page3).toHaveLength(10);

        // Verify order and content
        expect(at(page1, 0).messageNo).toBe(30);
        expect(at(page1, 9).messageNo).toBe(21);
        expect(at(page2, 0).messageNo).toBe(20);
        expect(at(page2, 9).messageNo).toBe(11);
        expect(at(page3, 0).messageNo).toBe(10);
        expect(at(page3, 9).messageNo).toBe(1);

        // No duplicates
        const allMessageNos = [
          ...page1.map((m) => m.messageNo),
          ...page2.map((m) => m.messageNo),
          ...page3.map((m) => m.messageNo),
        ];
        const uniqueMessageNos = new Set(allMessageNos);
        expect(uniqueMessageNos.size).toBe(30);
      });

      it("should handle forward pagination in chunks", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        // Seed 30 messages
        await seedMessagesForPagination(workspaceId, channelId, 30);

        // Paginate forwards from message 0 in chunks of 10
        const page1 = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          0,
          10,
          PaginationDirection.AFTER
        );
        const page2 = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          at(page1, page1.length - 1).messageNo,
          10,
          PaginationDirection.AFTER
        );
        const page3 = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          at(page2, page2.length - 1).messageNo,
          10,
          PaginationDirection.AFTER
        );

        // Verify we got all 30 messages across 3 pages
        expect(page1).toHaveLength(10);
        expect(page2).toHaveLength(10);
        expect(page3).toHaveLength(10);

        // Verify order and content
        expect(at(page1, 0).messageNo).toBe(1);
        expect(at(page1, 9).messageNo).toBe(10);
        expect(at(page2, 0).messageNo).toBe(11);
        expect(at(page2, 9).messageNo).toBe(20);
        expect(at(page3, 0).messageNo).toBe(21);
        expect(at(page3, 9).messageNo).toBe(30);

        // No duplicates
        const allMessageNos = [
          ...page1.map((m) => m.messageNo),
          ...page2.map((m) => m.messageNo),
          ...page3.map((m) => m.messageNo),
        ];
        const uniqueMessageNos = new Set(allMessageNos);
        expect(uniqueMessageNos.size).toBe(30);
      });
    });

    describe("data type conversions", () => {
      it("should return messageNo as number type for cursor-based queries", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        await seedMessagesForPagination(workspaceId, channelId, 5);

        const resultsBefore = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          6,
          5,
          PaginationDirection.BEFORE
        );

        const resultsAfter = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          0,
          5,
          PaginationDirection.AFTER
        );

        // Verify all messageNo values are numbers (not bigint)
        resultsBefore.forEach((message: MessageResponse) => {
          expect(typeof message.messageNo).toBe("number");
        });

        resultsAfter.forEach((message: MessageResponse) => {
          expect(typeof message.messageNo).toBe("number");
        });
      });

      it("should return all required message fields in cursor-based queries", async () => {
        const workspaceId = createTestUUID();
        const channelId = createTestUUID();

        await seedMessagesForPagination(workspaceId, channelId, 3);

        const results = await messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          4,
          5,
          PaginationDirection.BEFORE
        );

        expect(results).toHaveLength(3);

        // Verify all expected fields are present
        results.forEach((message: MessageResponse) => {
          expect(message).toHaveProperty("id");
          expect(message).toHaveProperty("workspaceId");
          expect(message).toHaveProperty("channelId");
          expect(message).toHaveProperty("messageNo");
          expect(message).toHaveProperty("userId");
          expect(message).toHaveProperty("content");
          expect(message).toHaveProperty("contentType");
          expect(message).toHaveProperty("isEdited");
          expect(message).toHaveProperty("editCount");
          expect(message).toHaveProperty("deliveryStatus");
          expect(message).toHaveProperty("parentMessageId");
          expect(message).toHaveProperty("threadRootId");
          expect(message).toHaveProperty("threadDepth");
          expect(message).toHaveProperty("createdAt");
          expect(message).toHaveProperty("updatedAt");

          // Verify types
          expect(typeof message.id).toBe("string");
          expect(typeof message.workspaceId).toBe("string");
          expect(typeof message.channelId).toBe("string");
          expect(typeof message.messageNo).toBe("number");
          expect(typeof message.userId).toBe("string");
          expect(typeof message.content).toBe("string");
          expect(typeof message.contentType).toBe("string");
          expect(typeof message.isEdited).toBe("boolean");
          expect(typeof message.editCount).toBe("number");
          expect(typeof message.deliveryStatus).toBe("string");
          expect(typeof message.threadDepth).toBe("number");
          expect(message.createdAt).toBeInstanceOf(Date);
          expect(message.updatedAt).toBeInstanceOf(Date);
        });
      });
    });
  });
});
