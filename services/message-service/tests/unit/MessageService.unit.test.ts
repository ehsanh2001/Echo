import "reflect-metadata";
import { MessageService } from "../../src/services/MessageService";
import { IMessageRepository } from "../../src/interfaces/repositories/IMessageRepository";
import { IUserServiceClient } from "../../src/interfaces/external/IUserServiceClient";
import { IWorkspaceChannelServiceClient } from "../../src/interfaces/external/IWorkspaceChannelServiceClient";
import { IRabbitMQService } from "../../src/interfaces/services/IRabbitMQService";
import { MessageServiceError } from "../../src/utils/errors";
import { PaginationDirection } from "../../src/types";
import { config } from "../../src/config/env";

describe("MessageService - Unit Tests", () => {
  let messageService: MessageService;
  let mockMessageRepository: jest.Mocked<IMessageRepository>;
  let mockUserServiceClient: jest.Mocked<IUserServiceClient>;
  let mockWorkspaceChannelServiceClient: jest.Mocked<IWorkspaceChannelServiceClient>;
  let mockRabbitMQService: jest.Mocked<IRabbitMQService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocks with proper method signatures
    mockMessageRepository = {
      create: jest.fn(),
      getMessagesWithCursor: jest.fn(),
    } as any;

    mockUserServiceClient = {
      getUserProfile: jest.fn(),
    } as any;

    mockWorkspaceChannelServiceClient = {
      getChannelMember: jest.fn(),
    } as any;

    mockRabbitMQService = {
      publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn(),
      close: jest.fn(),
    } as any;

    // Instantiate service with mocks
    messageService = new MessageService(
      mockMessageRepository,
      mockUserServiceClient,
      mockWorkspaceChannelServiceClient,
      mockRabbitMQService
    );
  });

  describe("sendMessage", () => {
    const workspaceId = "workspace-123";
    const channelId = "channel-123";
    const userId = "user-123";
    const content = "Hello, world!";

    describe("validation", () => {
      it("should reject empty content", async () => {
        await expect(
          messageService.sendMessage(workspaceId, channelId, userId, "")
        ).rejects.toThrow("Message content cannot be empty");
      });

      it("should reject whitespace-only content", async () => {
        await expect(
          messageService.sendMessage(workspaceId, channelId, userId, "   ")
        ).rejects.toThrow("Message content cannot be empty");
      });

      it("should reject content exceeding max length", async () => {
        const longContent = "a".repeat(config.message.maxLength + 1);
        await expect(
          messageService.sendMessage(
            workspaceId,
            channelId,
            userId,
            longContent
          )
        ).rejects.toThrow("Message content exceeds maximum length");
      });
    });

    describe("authorization", () => {
      it("should reject if user is not a channel member", async () => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue(
          null
        );

        await expect(
          messageService.sendMessage(workspaceId, channelId, userId, content)
        ).rejects.toThrow("User is not a member of this channel");
      });

      it("should allow message from channel member", async () => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockUserServiceClient.getUserProfile.mockResolvedValue({
          id: userId,
          username: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        } as any);

        mockMessageRepository.create.mockResolvedValue({
          id: "msg-123",
          messageNo: 1,
          workspaceId,
          channelId,
          userId,
          content,
          contentType: "text",
          isEdited: false,
          editCount: 0,
          deliveryStatus: "sent",
          parentMessageId: null,
          threadRootId: null,
          threadDepth: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await messageService.sendMessage(
          workspaceId,
          channelId,
          userId,
          content
        );

        expect(result).toBeDefined();
        expect(result.content).toBe(content);
        expect(result.author).toBeDefined();
        expect(result.author.username).toBe("testuser");
      });
    });

    describe("author info enrichment", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockMessageRepository.create.mockResolvedValue({
          id: "msg-123",
          messageNo: 1,
          workspaceId,
          channelId,
          userId,
          content,
          contentType: "text",
          isEdited: false,
          editCount: 0,
          deliveryStatus: "sent",
          parentMessageId: null,
          threadRootId: null,
          threadDepth: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      it("should include author info in response", async () => {
        mockUserServiceClient.getUserProfile.mockResolvedValue({
          id: userId,
          username: "testuser",
          displayName: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
        } as any);

        const result = await messageService.sendMessage(
          workspaceId,
          channelId,
          userId,
          content
        );

        expect(result.author).toEqual({
          id: userId,
          username: "testuser",
          displayName: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
        });
      });

      it("should throw error if user profile not found", async () => {
        mockUserServiceClient.getUserProfile.mockResolvedValue(null);

        await expect(
          messageService.sendMessage(workspaceId, channelId, userId, content)
        ).rejects.toThrow();
      });
    });

    describe("repository interaction", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockUserServiceClient.getUserProfile.mockResolvedValue({
          id: userId,
          username: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        } as any);
      });

      it("should call repository with correct parameters", async () => {
        mockMessageRepository.create.mockResolvedValue({
          id: "msg-123",
          messageNo: 1,
          workspaceId,
          channelId,
          userId,
          content,
          contentType: "text",
          isEdited: false,
          editCount: 0,
          deliveryStatus: "sent",
          parentMessageId: null,
          threadRootId: null,
          threadDepth: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await messageService.sendMessage(
          workspaceId,
          channelId,
          userId,
          content
        );

        expect(mockMessageRepository.create).toHaveBeenCalledWith({
          workspaceId,
          channelId,
          userId,
          content,
          contentType: "text",
        });
      });
    });

    describe("RabbitMQ event publishing", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockUserServiceClient.getUserProfile.mockResolvedValue({
          id: userId,
          username: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        } as any);

        mockMessageRepository.create.mockResolvedValue({
          id: "msg-123",
          messageNo: 1,
          workspaceId,
          channelId,
          userId,
          content,
          contentType: "text",
          isEdited: false,
          editCount: 0,
          deliveryStatus: "sent",
          parentMessageId: null,
          threadRootId: null,
          threadDepth: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      it("should publish message created event asynchronously", async () => {
        await messageService.sendMessage(
          workspaceId,
          channelId,
          userId,
          content
        );

        // Give time for async publish to be called
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockRabbitMQService.publishMessageEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "message.created",
            payload: expect.objectContaining({
              id: "msg-123",
              content,
            }),
          })
        );
      });

      it("should not fail if RabbitMQ publish fails", async () => {
        mockRabbitMQService.publishMessageEvent.mockRejectedValue(
          new Error("RabbitMQ unavailable")
        );

        const result = await messageService.sendMessage(
          workspaceId,
          channelId,
          userId,
          content
        );

        expect(result).toBeDefined();
        expect(result.id).toBe("msg-123");
      });
    });
  });

  describe("getMessageHistory", () => {
    const workspaceId = "workspace-123";
    const channelId = "channel-123";
    const userId = "user-123";

    const createMockMessage = (
      messageNo: number,
      userId: string,
      content: string
    ) => ({
      id: `msg-${messageNo}`,
      messageNo,
      workspaceId,
      channelId,
      userId,
      content,
      contentType: "text",
      isEdited: false,
      editCount: 0,
      deliveryStatus: "sent",
      parentMessageId: null,
      threadRootId: null,
      threadDepth: 0,
      createdAt: new Date(`2025-10-23T${messageNo.toString().padStart(2, "0")}:00:00Z`),
      updatedAt: new Date(`2025-10-23T${messageNo.toString().padStart(2, "0")}:00:00Z`),
    });

    describe("authorization", () => {
      it("should reject if user is not a channel member", async () => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue(
          null
        );

        await expect(
          messageService.getMessageHistory(workspaceId, channelId, userId, {})
        ).rejects.toThrow("User is not a member of this channel");
      });
    });

    describe("pagination - default behavior", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);
      });

      it("should fetch newest messages when no cursor provided", async () => {
        const mockMessages = [
          createMockMessage(8, "user-1", "Message 8"),
          createMockMessage(9, "user-2", "Message 9"),
          createMockMessage(10, "user-1", "Message 10"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        mockUserServiceClient.getUserProfile.mockImplementation((userId) =>
          Promise.resolve({
            id: userId,
            username: `user-${userId}`,
            displayName: `User ${userId}`,
            avatarUrl: null,
          } as any)
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {}
        );

        expect(mockMessageRepository.getMessagesWithCursor).toHaveBeenCalledWith(
          workspaceId,
          channelId,
          Number.MAX_SAFE_INTEGER,
          config.pagination.defaultLimit + 1,
          PaginationDirection.BEFORE
        );
        expect(result.messages).toHaveLength(3);
        expect(result.messages[0]!.messageNo).toBe(8);
        expect(result.messages[2]!.messageNo).toBe(10);
      });

      it("should apply default limit from config", async () => {
        mockMessageRepository.getMessagesWithCursor.mockResolvedValue([]);

        await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {}
        );

        expect(mockMessageRepository.getMessagesWithCursor).toHaveBeenCalledWith(
          workspaceId,
          channelId,
          expect.any(Number),
          config.pagination.defaultLimit + 1,
          expect.any(String)
        );
      });
    });

    describe("pagination - cursor navigation", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockUserServiceClient.getUserProfile.mockImplementation((userId) =>
          Promise.resolve({
            id: userId,
            username: `user-${userId}`,
            displayName: `User ${userId}`,
            avatarUrl: null,
          } as any)
        );
      });

      it("should fetch older messages with BEFORE direction", async () => {
        const mockMessages = [
          createMockMessage(1, "user-1", "Message 1"),
          createMockMessage(2, "user-2", "Message 2"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {
            cursor: 5,
            limit: 10,
            direction: PaginationDirection.BEFORE,
          }
        );

        expect(mockMessageRepository.getMessagesWithCursor).toHaveBeenCalledWith(
          workspaceId,
          channelId,
          5,
          11, // limit + 1
          PaginationDirection.BEFORE
        );
        expect(result.messages).toHaveLength(2);
      });

      it("should fetch newer messages with AFTER direction", async () => {
        const mockMessages = [
          createMockMessage(6, "user-1", "Message 6"),
          createMockMessage(7, "user-2", "Message 7"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {
            cursor: 5,
            limit: 10,
            direction: PaginationDirection.AFTER,
          }
        );

        expect(mockMessageRepository.getMessagesWithCursor).toHaveBeenCalledWith(
          workspaceId,
          channelId,
          5,
          11,
          PaginationDirection.AFTER
        );
        expect(result.messages).toHaveLength(2);
      });
    });

    describe("pagination - hasMore detection", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockUserServiceClient.getUserProfile.mockImplementation((userId) =>
          Promise.resolve({
            id: userId,
            username: `user-${userId}`,
            displayName: `User ${userId}`,
            avatarUrl: null,
          } as any)
        );
      });

      it("should set hasMore=true when repository returns limit+1 messages", async () => {
        const limit = 2;
        const mockMessages = [
          createMockMessage(1, "user-1", "Message 1"),
          createMockMessage(2, "user-2", "Message 2"),
          createMockMessage(3, "user-1", "Message 3"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          { limit }
        );

        expect(result.messages).toHaveLength(2); // Trimmed to limit
        expect(result.prevCursor).not.toBeNull(); // Has more older messages
      });

      it("should trim to limit when repository returns more messages", async () => {
        const mockMessages = [createMockMessage(1, "user-1", "Message 1")];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          { limit: 10 }
        );

        expect(result.messages).toHaveLength(1);
      });
    });

    describe("pagination - cursor calculation", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);

        mockUserServiceClient.getUserProfile.mockImplementation((userId) =>
          Promise.resolve({
            id: userId,
            username: `user-${userId}`,
            displayName: `User ${userId}`,
            avatarUrl: null,
          } as any)
        );
      });

      it("should calculate cursors correctly for BEFORE direction with hasMore", async () => {
        const mockMessages = [
          createMockMessage(1, "user-1", "Message 1"),
          createMockMessage(2, "user-2", "Message 2"),
          createMockMessage(3, "user-1", "Message 3"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {
            cursor: 10,
            limit: 2,
            direction: PaginationDirection.BEFORE,
          }
        );

        expect(result.prevCursor).toBe(1); // First message (older)
        expect(result.nextCursor).toBe(2); // Last visible message after trim (newer)
      });

      it("should calculate cursors correctly for AFTER direction with more messages", async () => {
        const mockMessages = [
          createMockMessage(6, "user-1", "Message 6"),
          createMockMessage(7, "user-2", "Message 7"),
          createMockMessage(8, "user-1", "Message 8"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {
            cursor: 5,
            limit: 2,
            direction: PaginationDirection.AFTER,
          }
        );

        // When we get 3 messages but limit=2, we trim to [6, 7]
        // For AFTER direction: prevCursor=first visible, nextCursor=last visible (since hasMore)
        expect(result.prevCursor).toBe(6); // First visible message (older)
        expect(result.nextCursor).toBe(7); // Last visible message (indicates more exist)
        expect(result.messages).toHaveLength(2); // Trimmed to limit
      });

      it("should set prevCursor=null when no more older messages", async () => {
        const mockMessages = [createMockMessage(1, "user-1", "Message 1")];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {
            cursor: 5,
            limit: 10,
            direction: PaginationDirection.BEFORE,
          }
        );

        expect(result.prevCursor).toBeNull();
        expect(result.nextCursor).toBe(1);
      });

      it("should set nextCursor=null when no more newer messages", async () => {
        const mockMessages = [createMockMessage(10, "user-1", "Message 10")];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {
            cursor: 5,
            limit: 10,
            direction: PaginationDirection.AFTER,
          }
        );

        expect(result.prevCursor).toBe(10);
        expect(result.nextCursor).toBeNull();
      });
    });

    describe("author info enrichment", () => {
      beforeEach(() => {
        mockWorkspaceChannelServiceClient.getChannelMember.mockResolvedValue({
          channelId,
          userId,
          role: "member",
          isActive: true,
        } as any);
      });

      it("should enrich messages with author info", async () => {
        const mockMessages = [
          createMockMessage(1, "user-1", "Message 1"),
          createMockMessage(2, "user-2", "Message 2"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        mockUserServiceClient.getUserProfile.mockImplementation((userId) => {
          const profiles: Record<string, any> = {
            "user-1": {
              id: "user-1",
              username: "alice",
              displayName: "Alice",
              avatarUrl: null,
            },
            "user-2": {
              id: "user-2",
              username: "bob",
              displayName: "Bob",
              avatarUrl: "https://example.com/bob.jpg",
            },
          };
          return Promise.resolve(profiles[userId] || null);
        });

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {}
        );

        expect(result.messages[0]!.author.username).toBe("alice");
        expect(result.messages[1]!.author.username).toBe("bob");
        expect(result.messages[1]!.author.avatarUrl).toBe(
          "https://example.com/bob.jpg"
        );
      });

      it("should use fallback author info when user service fails for a user", async () => {
        const mockMessages = [
          createMockMessage(1, "user-1", "Message 1"),
          createMockMessage(2, "user-2", "Message 2"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        mockUserServiceClient.getUserProfile.mockImplementation((userId) => {
          if (userId === "user-1") {
            return Promise.resolve({
              id: "user-1",
              username: "alice",
              displayName: "Alice",
              avatarUrl: null,
            } as any);
          }
          return Promise.reject(new Error("User service unavailable"));
        });

        const result = await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {}
        );

        expect(result.messages[0]!.author.username).toBe("alice");
        expect(result.messages[1]!.author.username).toBe("Unknown User");
        expect(result.messages[1]!.author.id).toBe("user-2");
      });

      it("should deduplicate user IDs before fetching profiles", async () => {
        const mockMessages = [
          createMockMessage(1, "user-1", "Message 1"),
          createMockMessage(2, "user-1", "Message 2"),
          createMockMessage(3, "user-2", "Message 3"),
        ];

        mockMessageRepository.getMessagesWithCursor.mockResolvedValue(
          mockMessages
        );

        mockUserServiceClient.getUserProfile.mockResolvedValue({
          id: "user-1",
          username: "alice",
          displayName: "Alice",
          avatarUrl: null,
        } as any);

        await messageService.getMessageHistory(
          workspaceId,
          channelId,
          userId,
          {}
        );

        // Should only call getUserProfile twice (user-1 and user-2), not three times
        expect(mockUserServiceClient.getUserProfile).toHaveBeenCalledTimes(2);
      });
    });
  });
});
