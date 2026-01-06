import {
  MessageWithAuthorResponse,
  MessageHistoryQueryParams,
  MessageHistoryResponse,
} from "../../types";

/**
 * Interface for message service business logic
 */
export interface IMessageService {
  /**
   * Send a message to a channel
   * @param workspaceId - The workspace ID where the channel belongs
   * @param channelId - The channel ID where the message should be sent
   * @param userId - The ID of the user sending the message
   * @param content - The message content
   * @param clientMessageCorrelationId - Client-generated correlation ID for matching optimistic updates
   * @param parentMessageId - Optional parent message ID for replies
   * @returns Promise resolving to the created message with author information
   * @throws MessageServiceError for business logic violations
   */
  sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    content: string,
    clientMessageCorrelationId: string,
    parentMessageId?: string
  ): Promise<MessageWithAuthorResponse>;

  /**
   * Get a single message by ID
   * @param workspaceId - The workspace ID where the channel belongs
   * @param channelId - The channel ID where the message exists
   * @param messageId - The message UUID
   * @param userId - The ID of the user requesting the message (for access control)
   * @returns Promise resolving to the message with author information
   * @throws MessageServiceError if message not found or user is not a member
   */
  getMessageById(
    workspaceId: string,
    channelId: string,
    messageId: string,
    userId: string
  ): Promise<MessageWithAuthorResponse>;

  /**
   * Get message history for a channel with cursor-based pagination
   * @param workspaceId - The workspace ID where the channel belongs
   * @param channelId - The channel ID to retrieve messages from
   * @param userId - The ID of the user requesting messages (for access control)
   * @param params - Pagination parameters (cursor, limit, direction)
   * @returns Promise resolving to message history with pagination cursors
   * @throws MessageServiceError if user is not a member or invalid parameters
   */
  getMessageHistory(
    workspaceId: string,
    channelId: string,
    userId: string,
    params: MessageHistoryQueryParams
  ): Promise<MessageHistoryResponse>;

  /**
   * Delete all messages for a channel
   * Called when a channel is deleted via RabbitMQ event
   *
   * @param workspaceId - The workspace ID (partition key)
   * @param channelId - The channel ID whose messages should be deleted
   * @returns Number of messages deleted
   * @throws MessageServiceError if deletion fails
   */
  deleteMessagesByChannel(
    workspaceId: string,
    channelId: string
  ): Promise<number>;
}
