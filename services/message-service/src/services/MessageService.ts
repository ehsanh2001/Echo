import { injectable, inject } from "tsyringe";
import logger from "../utils/logger";
import { IMessageService } from "../interfaces/services/IMessageService";
import {
  IRabbitMQService,
  MessageCreatedEvent,
} from "../interfaces/services/IRabbitMQService";
import { IMessageRepository } from "../interfaces/repositories/IMessageRepository";
import { IReadReceiptRepository } from "../interfaces/repositories/IReadReceiptRepository";
import { IUserServiceClient } from "../interfaces/external/IUserServiceClient";
import { IWorkspaceChannelServiceClient } from "../interfaces/external/IWorkspaceChannelServiceClient";
import {
  MessageWithAuthorResponse,
  AuthorInfo,
  MessageHistoryQueryParams,
  MessageHistoryResponse,
  PaginationDirection,
  MessageResponse,
} from "../types";
import { config } from "../config/env";
import { MessageServiceError } from "../utils/errors";

/**
 * Message service implementing business logic for message operations
 */
@injectable()
export class MessageService implements IMessageService {
  constructor(
    @inject("IMessageRepository") private messageRepository: IMessageRepository,
    @inject("IReadReceiptRepository")
    private readReceiptRepository: IReadReceiptRepository,
    @inject("IUserServiceClient") private userServiceClient: IUserServiceClient,
    @inject("IWorkspaceChannelServiceClient")
    private workspaceChannelServiceClient: IWorkspaceChannelServiceClient,
    @inject("IRabbitMQService") private rabbitMQService: IRabbitMQService
  ) {}

  /**
   * Send a message to a channel
   *
   * Business Flow:
   * 1. Validate content (not empty, within length limits)
   * 2. Verify membership and get author info
   * 3. Validate parent message if replying
   * 4. Create message via repository
   * 5. Create response with author info
   * 6. Publish RabbitMQ event
   * 7. Return formatted response with author info
   */
  async sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    content: string,
    clientMessageCorrelationId: string,
    parentMessageId?: string
  ): Promise<MessageWithAuthorResponse> {
    logger.info("Sending message", {
      workspaceId,
      channelId,
      contentLength: content.length,
      parentMessageId: parentMessageId || null,
    });

    // Step 1: Validate content
    this.validateContent(content);

    // Step 2: Verify membership and get author info concurrently
    const [, authorInfo] = await Promise.all([
      this.verifyChannelMembership(workspaceId, channelId, userId),
      this.getAuthorInfo(userId),
    ]);

    // Step 3: Validate parent message if replying
    if (parentMessageId) {
      await this.validateParentMessage(workspaceId, channelId, parentMessageId);
    }

    // Step 4: Create message via repository
    const message = await this.messageRepository.create({
      workspaceId,
      channelId,
      userId,
      content,
      contentType: "text", // Only plain text for now
      parentMessageId: parentMessageId || null,
    });

    // Step 5: Create response with author info
    const messageWithAuthor: MessageWithAuthorResponse = {
      ...message,
      author: authorInfo,
      clientMessageCorrelationId,
    };

    logger.info("Message created successfully", {
      messageId: message.id,
      channelId,
      workspaceId,
      authorId: userId,
      authorUsername: authorInfo.username,
      parentMessageId: parentMessageId || null,
    });

    // Step 6: Publish RabbitMQ event (async, don't wait)
    this.publishMessageEvent(messageWithAuthor).catch((error) => {
      logger.error("Failed to publish message event", {
        error,
        messageId: message.id,
      });
      // Don't throw - message creation succeeded
    });

    // Step 7: Return formatted response
    return messageWithAuthor;
  }

  /**
   * Get a single message by ID
   *
   * Business Flow:
   * 1. Verify channel membership
   * 2. Fetch message from repository
   * 3. Validate message belongs to the specified workspace/channel
   * 4. Enrich with author information
   * 5. Return message with author info
   */
  async getMessageById(
    workspaceId: string,
    channelId: string,
    messageId: string,
    userId: string
  ): Promise<MessageWithAuthorResponse> {
    logger.info("Getting message by ID", {
      workspaceId,
      channelId,
      messageId,
    });

    // Step 1: Verify channel membership
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    // Step 2: Fetch message from repository
    const message = await this.messageRepository.findById(messageId);

    // Step 3: Validate message exists and belongs to correct workspace/channel
    if (!message) {
      throw MessageServiceError.notFound("Message", messageId);
    }

    if (
      message.workspaceId !== workspaceId ||
      message.channelId !== channelId
    ) {
      // Message exists but not in the specified workspace/channel
      throw MessageServiceError.notFound("Message", messageId);
    }

    // Step 4: Get author info (with fallback)
    const authorInfo = await this.getAuthorInfoWithFallback(message.userId);

    logger.info("Message retrieved successfully", {
      messageId: message.id,
      workspaceId,
      channelId,
      userId: message.userId,
      authorUsername: authorInfo.username,
      hasParent: !!message.parentMessageId,
    });

    // Step 5: Return message with author info
    return {
      ...message,
      author: authorInfo,
    };
  }

  /**
   * Validate that parent message exists in the same channel
   */
  private async validateParentMessage(
    workspaceId: string,
    channelId: string,
    parentMessageId: string
  ): Promise<void> {
    logger.debug("Validating parent message", {
      parentMessageId,
      workspaceId,
      channelId,
    });

    const parentMessage =
      await this.messageRepository.findById(parentMessageId);

    if (!parentMessage) {
      logger.warn("Parent message not found", {
        parentMessageId,
        workspaceId,
        channelId,
      });
      throw MessageServiceError.validation("Parent message not found", {
        field: "parentMessageId",
        value: parentMessageId,
      });
    }

    // Ensure parent message is in the same workspace and channel
    if (
      parentMessage.workspaceId !== workspaceId ||
      parentMessage.channelId !== channelId
    ) {
      logger.warn("Parent message in different channel", {
        parentMessageId,
        expectedWorkspaceId: workspaceId,
        expectedChannelId: channelId,
        actualWorkspaceId: parentMessage.workspaceId,
        actualChannelId: parentMessage.channelId,
      });
      throw MessageServiceError.validation(
        "Parent message must be in the same channel",
        {
          field: "parentMessageId",
          value: parentMessageId,
          expectedWorkspaceId: workspaceId,
          expectedChannelId: channelId,
        }
      );
    }

    logger.debug("Parent message validated successfully", {
      parentMessageId,
      parentAuthorId: parentMessage.userId,
    });
  }

  /**
   * Validate message content
   */
  private validateContent(content: string): void {
    // Check for empty content
    if (!content || content.trim().length === 0) {
      throw MessageServiceError.emptyMessage();
    }

    // Check for content length
    if (content.length > config.message.maxLength) {
      throw MessageServiceError.messageTooLong(
        config.message.maxLength,
        content.length
      );
    }
  }

  /**
   * Verify user is a member of the channel
   */
  private async verifyChannelMembership(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      // Check if user is member of channel
      const member = await this.workspaceChannelServiceClient.getChannelMember(
        workspaceId,
        channelId,
        userId
      );

      if (!member) {
        throw MessageServiceError.notChannelMember(channelId, userId);
      }

      // Additional checks could be added here:
      // - Channel archived status
      // - Channel read-only status
      // - User muted status
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // External service error
      throw MessageServiceError.externalService(
        "workspace-channel-service",
        "Failed to verify channel membership",
        { workspaceId, channelId, userId }
      );
    }
  }

  /**
   * Get author information for the response
   */
  private async getAuthorInfo(userId: string): Promise<AuthorInfo> {
    try {
      const userProfile = await this.userServiceClient.getUserProfile(userId);

      if (!userProfile) {
        throw MessageServiceError.notFound("User", userId);
      }

      return {
        id: userProfile.id,
        username: userProfile.username,
        displayName: userProfile.displayName,
        avatarUrl: userProfile.avatarUrl,
      };
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // External service error
      throw MessageServiceError.externalService(
        "user-service",
        "Failed to get user profile",
        { userId }
      );
    }
  }

  /**
   * Get author information with fallback for resilience
   * Returns fallback data instead of throwing if user service fails
   */
  private async getAuthorInfoWithFallback(userId: string): Promise<AuthorInfo> {
    try {
      return await this.getAuthorInfo(userId);
    } catch (error) {
      logger.error(`Failed to fetch author info for user ${userId}:`, error);
      // Return fallback author info if user service fails
      return {
        id: userId,
        username: "Unknown User",
        displayName: "Unknown User",
        avatarUrl: null,
      };
    }
  }

  /**
   * Publish message created event to RabbitMQ
   */
  private async publishMessageEvent(
    messageWithAuthor: MessageWithAuthorResponse
  ): Promise<void> {
    const event: MessageCreatedEvent = {
      type: "message.created",
      payload: messageWithAuthor,
      timestamp: new Date().toISOString(),
      metadata: {
        timestamp: new Date().toISOString(),
        service: "message-service",
        version: "1.0",
      },
    };

    await this.rabbitMQService.publishMessageEvent(event);
  }

  /**
   * Get message history for a channel with cursor-based pagination
   *
   * Simplified pagination approach:
   * - Initial load (no cursor): Returns ALL unread messages OR last N messages
   *   - Always includes the latest messages (no "gap" to newest)
   *   - startedFromUnread flag indicates if there's an unread separator to show
   *   - firstUnreadIndex indicates where to place the "New messages" separator
   * - Subsequent loads (cursor provided): Only loads OLDER messages (BEFORE direction)
   *   - nextCursor is always null (we always have the latest)
   *   - prevCursor points to older messages
   *
   * Business Flow:
   * 1. Verify channel membership (fail fast if unauthorized)
   * 2. Determine if initial load or pagination
   * 3. Fetch appropriate messages
   * 4. Enrich messages with author information (with fallback on failure)
   * 5. Calculate pagination cursor (only prevCursor for older messages)
   * 6. Return paginated response
   *
   * Resilience: If user-service is unavailable when enriching author information,
   * messages will include fallback author data ("Unknown User") rather than failing.
   * This ensures message history remains accessible even when user-service is down.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - Requesting user's UUID (verified for channel membership)
   * @param params - Pagination parameters (cursor, limit)
   * @returns Paginated message history with author information and navigation cursors
   * @throws MessageServiceError if user is not a channel member or validation fails
   */
  async getMessageHistory(
    workspaceId: string,
    channelId: string,
    userId: string,
    params: MessageHistoryQueryParams
  ): Promise<MessageHistoryResponse> {
    logger.info("Fetching message history", {
      workspaceId,
      channelId,
      cursor: params.cursor,
      limit: params.limit,
      isInitialLoad: params.cursor === undefined,
    });

    // Step 1: Verify channel membership
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    // Step 2: Determine limit
    const limit = params.limit || config.pagination.defaultLimit;

    // Step 3: Fetch messages based on load type
    let messages: MessageResponse[];
    let startedFromUnread = false;
    let hasOlderMessages = false;
    let firstUnreadIndex = -1;

    if (this.isInitialLoad(params)) {
      // Initial load - get ALL unread or last N
      const result = await this.getInitialLoadMessages(
        workspaceId,
        channelId,
        userId,
        limit
      );
      messages = result.messages;
      startedFromUnread = result.startedFromUnread;
      hasOlderMessages = result.hasOlderMessages;
      firstUnreadIndex = result.firstUnreadIndex;
    } else {
      // Pagination - load older messages
      const result = await this.getPaginatedMessages(
        workspaceId,
        channelId,
        params.cursor!,
        limit
      );
      messages = result.messages;
      hasOlderMessages = result.hasOlderMessages;
    }

    // Step 4: Enrich messages with author information
    const messagesWithAuthors = await this.enrichMessagesWithAuthors(messages);

    // Step 5: Calculate pagination cursors
    // With simplified approach:
    // - nextCursor is ALWAYS null (we always have the latest messages)
    // - prevCursor points to older messages (if any exist)
    const firstMessage = messagesWithAuthors[0];
    const prevCursor =
      hasOlderMessages && firstMessage ? firstMessage.messageNo : null;

    // Step 6: Return paginated response
    return {
      messages: messagesWithAuthors,
      nextCursor: null, // Always null - we always have the latest
      prevCursor,
      startedFromUnread,
      firstUnreadIndex,
    };
  }

  /**
   * Check if this is an initial load (subsequent loads only support BEFORE direction)
   *
   * Simplified pagination:
   * - Initial load (no cursor): Get ALL unread messages OR last N messages
   * - Subsequent loads (with cursor): Only BEFORE direction (load older messages)
   *
   * @param params - Pagination parameters
   * @returns Whether this is an initial load
   */
  private isInitialLoad(params: MessageHistoryQueryParams): boolean {
    return params.cursor === undefined;
  }

  /**
   * Handle initial load - returns ALL unread messages or last N messages
   *
   * Simplified approach:
   * - If user has unread messages: Fetch ALL unread messages + ensure minimum total
   * - If no unread: Fetch last N messages
   *
   * This eliminates "gaps" - we always have the latest messages after initial load.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - User UUID (for read receipt lookup)
   * @param limit - Minimum number of messages to return
   * @returns Initial messages with metadata
   */
  private async getInitialLoadMessages(
    workspaceId: string,
    channelId: string,
    userId: string,
    limit: number
  ): Promise<{
    messages: MessageResponse[];
    startedFromUnread: boolean;
    hasOlderMessages: boolean;
    firstUnreadIndex: number;
  }> {
    // Get read receipt and latest message number in parallel
    const [readReceipt, latestMessageNo] = await Promise.all([
      this.readReceiptRepository.getReadReceipt(workspaceId, channelId, userId),
      this.messageRepository.getChannelLastMessageNo(workspaceId, channelId),
    ]);

    const lastReadMessageNo = readReceipt?.lastReadMessageNo ?? 0;
    const hasUnreadMessages =
      lastReadMessageNo > 0 && lastReadMessageNo < latestMessageNo;

    if (hasUnreadMessages) {
      logger.info("Initial load: Fetching unread messages", {
        workspaceId,
        channelId,
        userId,
        lastReadMessageNo,
        latestMessageNo,
        estimatedUnread: latestMessageNo - lastReadMessageNo,
        maxLimit: config.pagination.initialLoadMaxLimit,
      });

      // Fetch unread messages with safety limit
      // If there are more unread messages than the limit, we return the LATEST messages
      // This ensures the user sees the most recent messages first
      const unreadMessages = await this.messageRepository.getMessagesWithCursor(
        workspaceId,
        channelId,
        lastReadMessageNo,
        config.pagination.initialLoadMaxLimit, // Safety limit to prevent fetching millions
        PaginationDirection.AFTER
      );

      // If we have fewer than 'limit' messages, fetch older messages to fill up
      let olderMessages: MessageResponse[] = [];
      let hasOlderMessages = false;

      if (unreadMessages.length < limit) {
        const neededOlder = limit - unreadMessages.length + 1; // +1 to check hasMore
        olderMessages = await this.messageRepository.getMessagesWithCursor(
          workspaceId,
          channelId,
          lastReadMessageNo + 1, // Start from oldest unread (or just after last read)
          neededOlder,
          PaginationDirection.BEFORE
        );
        hasOlderMessages = olderMessages.length > limit - unreadMessages.length;
        // Trim to exact count if we got extra
        if (hasOlderMessages) {
          olderMessages = olderMessages.slice(1); // Remove oldest (was for hasMore check)
        }
      } else {
        // Have enough unread, just check if there are older messages
        hasOlderMessages = lastReadMessageNo > 0;
      }

      // Combine: [older..., unread...]
      const allMessages = [...olderMessages, ...unreadMessages];
      const firstUnreadIndex = olderMessages.length;

      logger.info("Initial load complete: Unread messages fetched", {
        workspaceId,
        channelId,
        unreadCount: unreadMessages.length,
        olderCount: olderMessages.length,
        totalCount: allMessages.length,
        firstUnreadIndex,
        hasOlderMessages,
      });

      return {
        messages: allMessages,
        startedFromUnread: true,
        hasOlderMessages,
        firstUnreadIndex,
      };
    }

    // No unread messages - load latest messages
    logger.info("Initial load: No unread, fetching latest messages", {
      workspaceId,
      channelId,
      userId,
      lastReadMessageNo,
      latestMessageNo,
      limit,
    });

    // Fetch last N messages (+ 1 to check hasMore)
    const messages = await this.messageRepository.getMessagesWithCursor(
      workspaceId,
      channelId,
      Number.MAX_SAFE_INTEGER,
      limit + 1,
      PaginationDirection.BEFORE
    );

    const hasOlderMessages = messages.length > limit;
    const pageMessages = hasOlderMessages ? messages.slice(1) : messages;

    logger.info("Initial load complete: Latest messages fetched", {
      workspaceId,
      channelId,
      messageCount: pageMessages.length,
      hasOlderMessages,
    });

    return {
      messages: pageMessages,
      startedFromUnread: false,
      hasOlderMessages,
      firstUnreadIndex: -1, // No unread separator needed
    };
  }

  /**
   * Handle pagination (load older messages)
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param cursor - Cursor to paginate from
   * @param limit - Number of messages to fetch
   * @returns Paginated messages
   */
  private async getPaginatedMessages(
    workspaceId: string,
    channelId: string,
    cursor: number,
    limit: number
  ): Promise<{
    messages: MessageResponse[];
    hasOlderMessages: boolean;
  }> {
    logger.info("Loading older messages", {
      workspaceId,
      channelId,
      cursor,
      limit,
    });

    // Always use BEFORE direction (only load older messages)
    const messages = await this.messageRepository.getMessagesWithCursor(
      workspaceId,
      channelId,
      cursor,
      limit + 1, // +1 to check hasMore
      PaginationDirection.BEFORE
    );

    const hasOlderMessages = messages.length > limit;
    const pageMessages = hasOlderMessages ? messages.slice(1) : messages;

    return {
      messages: pageMessages,
      hasOlderMessages,
    };
  }

  /**
   * Enrich messages with author information
   */
  private async enrichMessagesWithAuthors(
    messages: MessageResponse[]
  ): Promise<MessageWithAuthorResponse[]> {
    if (messages.length === 0) {
      return [];
    }

    // Extract unique user IDs
    const userIds = [...new Set(messages.map((msg) => msg.userId))];

    // Fetch all user profiles concurrently
    const userProfiles = await Promise.all(
      userIds.map((userId) =>
        this.getAuthorInfo(userId).catch((error) => {
          logger.error(
            `Failed to fetch author info for user ${userId}:`,
            error
          );
          // Return fallback author info if user service fails
          return {
            id: userId,
            username: "Unknown User",
            displayName: "Unknown User",
            avatarUrl: null,
          };
        })
      )
    );

    // Create a map for quick lookup
    const userMap = new Map<string, AuthorInfo>(
      userProfiles.map((profile) => [profile.id, profile])
    );

    // Enrich messages with author info
    return messages.map((message) => ({
      ...message,
      author: userMap.get(message.userId)!,
    }));
  }

  /**
   * Delete all messages for a channel
   *
   * Called when a channel.deleted event is received from RabbitMQ.
   * Uses bulk delete with workspaceId for partition-aware queries.
   *
   * @param workspaceId - The workspace ID (partition key)
   * @param channelId - The channel ID whose messages should be deleted
   * @returns Number of messages deleted
   */
  async deleteMessagesByChannel(
    workspaceId: string,
    channelId: string
  ): Promise<number> {
    logger.info("Deleting all messages for channel", {
      workspaceId,
      channelId,
    });

    const deletedCount = await this.messageRepository.deleteByChannelId(
      workspaceId,
      channelId
    );

    logger.info("Messages deleted for channel", {
      workspaceId,
      channelId,
      deletedCount,
    });

    return deletedCount;
  }

  /**
   * Delete all messages for a workspace
   *
   * Called when a workspace.deleted event is received from RabbitMQ.
   * Deletes all messages across all channels in the workspace in a single operation.
   *
   * @param workspaceId - The workspace ID whose messages should be deleted
   * @returns Number of messages deleted
   */
  async deleteMessagesByWorkspace(workspaceId: string): Promise<number> {
    logger.info("Deleting all messages for workspace", {
      workspaceId,
    });

    const deletedCount =
      await this.messageRepository.deleteByWorkspaceId(workspaceId);

    logger.info("Messages deleted for workspace", {
      workspaceId,
      deletedCount,
    });

    return deletedCount;
  }
}
