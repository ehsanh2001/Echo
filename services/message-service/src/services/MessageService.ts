import { injectable, inject } from "tsyringe";
import logger from "../utils/logger";
import { IMessageService } from "../interfaces/services/IMessageService";
import {
  IRabbitMQService,
  MessageCreatedEvent,
} from "../interfaces/services/IRabbitMQService";
import { IMessageRepository } from "../interfaces/repositories/IMessageRepository";
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
   * 3. Create message via repository
   * 4. Create response with author info
   * 5. Publish RabbitMQ event
   * 6. Return formatted response with author info
   */
  async sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    content: string,
    clientMessageCorrelationId: string
  ): Promise<MessageWithAuthorResponse> {
    logger.info("Sending message", {
      workspaceId,
      channelId,
      contentLength: content.length,
    });

    // Step 1: Validate content
    this.validateContent(content);

    // Step 2: Verify membership and get author info concurrently
    const [, authorInfo] = await Promise.all([
      this.verifyChannelMembership(workspaceId, channelId, userId),
      this.getAuthorInfo(userId),
    ]);

    // Step 3: Create message via repository
    const message = await this.messageRepository.create({
      workspaceId,
      channelId,
      userId,
      content,
      contentType: "text", // Only plain text for now
    });

    // Step 4: Create response with author info
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
    });

    // Step 5: Publish RabbitMQ event (async, don't wait)
    this.publishMessageEvent(messageWithAuthor).catch((error) => {
      logger.error("Failed to publish message event", {
        error,
        messageId: message.id,
      });
      // Don't throw - message creation succeeded
    });

    // Step 6: Return formatted response
    return messageWithAuthor;
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
   * Business Flow:
   * 1. Verify channel membership (fail fast if unauthorized)
   * 2. Validate and normalize pagination parameters
   * 3. Fetch messages from repository (request limit + 1 to detect hasMore)
   * 4. Determine if more messages exist and extract actual page
   * 5. Enrich messages with author information (with fallback on failure)
   * 6. Calculate pagination cursors (nextCursor, prevCursor)
   * 7. Return paginated response
   *
   * Resilience: If user-service is unavailable when enriching author information,
   * messages will include fallback author data ("Unknown User") rather than failing.
   * This ensures message history remains accessible even when user-service is down.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - Requesting user's UUID (verified for channel membership)
   * @param params - Pagination parameters (cursor, limit, direction)
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
      direction: params.direction,
    });

    // Step 1: Verify channel membership
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    // Step 2: Normalize pagination parameters (apply defaults)
    const { cursor, limit, direction } = this.normalizePaginationParams(params);

    // Step 3: Fetch messages based on direction (request limit + 1 to detect hasMore)
    const messages = await this.messageRepository.getMessagesWithCursor(
      workspaceId,
      channelId,
      cursor,
      limit + 1,
      direction
    );

    // Step 4: Determine if there are more messages and extract actual page
    const hasMore = messages.length > limit;
    let pageMessages: MessageResponse[];
    if (direction === PaginationDirection.BEFORE) {
      pageMessages = hasMore ? messages.slice(1) : messages;
    } else {
      pageMessages = hasMore ? messages.slice(0, limit) : messages;
    }
    // Step 5: Enrich messages with author information
    const messagesWithAuthors =
      await this.enrichMessagesWithAuthors(pageMessages);

    // Step 6: Calculate pagination cursors
    const { nextCursor, prevCursor } = this.calculatePaginationCursors(
      messagesWithAuthors,
      direction,
      hasMore
    );

    // Step 7: Return paginated response
    return {
      messages: messagesWithAuthors,
      nextCursor,
      prevCursor,
    };
  }

  /**
   * Validate and normalize pagination parameters
   */
  private normalizePaginationParams(params: MessageHistoryQueryParams): {
    cursor: number;
    limit: number;
    direction: PaginationDirection;
  } {
    const { cursor, limit, direction } = params;

    // Note: Validation is already done in the controller layer
    // This method only applies defaults for business logic

    // Default direction is BEFORE (loading older messages)
    const normalizedDirection = direction || PaginationDirection.BEFORE;

    // Default limit
    const normalizedLimit = limit || config.pagination.defaultLimit;

    // Default cursor: 0 for AFTER (start from beginning), Number.MAX_SAFE_INTEGER for BEFORE (start from end)
    const normalizedCursor =
      cursor !== undefined
        ? cursor
        : normalizedDirection === PaginationDirection.AFTER
          ? 0
          : Number.MAX_SAFE_INTEGER;

    return {
      cursor: normalizedCursor,
      limit: normalizedLimit,
      direction: normalizedDirection,
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
   * Calculate pagination cursors based on current page
   *
   * Cursor semantics (consistent regardless of fetch direction):
   * - prevCursor: Always points to older messages (lower messageNo)
   * - nextCursor: Always points to newer messages (higher messageNo)
   *
   * Note: Repository always returns messages in ASC order (oldest to newest).
   */
  private calculatePaginationCursors(
    messages: MessageWithAuthorResponse[],
    direction: PaginationDirection,
    hasMore: boolean
  ): { nextCursor: number | null; prevCursor: number | null } {
    if (messages.length === 0) {
      return { nextCursor: null, prevCursor: null };
    }

    // Messages are always in ASC order: [oldest, ..., newest]
    const firstMessage = messages[0]!; // Oldest message in page
    const lastMessage = messages[messages.length - 1]!; // Newest message in page

    if (direction === PaginationDirection.BEFORE) {
      // Fetched older messages (< cursor), returned in ASC order: [950, 951, ..., 998, 999]
      // firstMessage.messageNo = 950 (oldest in this page)
      // lastMessage.messageNo = 999 (newest in this page)
      return {
        nextCursor: lastMessage.messageNo, // Load newer messages (> 999)
        prevCursor: hasMore ? firstMessage.messageNo : null, // Load older messages (< 950)
      };
    } else {
      // Fetched newer messages (> cursor), returned in ASC order: [1001, 1002, ..., 1049, 1050]
      // firstMessage.messageNo = 1001 (oldest in this page)
      // lastMessage.messageNo = 1050 (newest in this page)
      return {
        nextCursor: hasMore ? lastMessage.messageNo : null, // Load newer messages (> 1050)
        prevCursor: firstMessage.messageNo, // Load older messages (< 1001)
      };
    }
  }
}
