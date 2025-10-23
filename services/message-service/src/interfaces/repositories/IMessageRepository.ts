import {
  CreateMessageData,
  MessageResponse,
  PaginationDirection,
} from "../../types";

/**
 * Interface for message repository operations
 *
 * Handles data access layer for messages in PostgreSQL
 */
export interface IMessageRepository {
  /**
   * Create a new message in a channel
   *
   * @param data - Message data to create (messageNo generated internally)
   * @returns Created message with all fields including generated messageNo
   * @throws MessageServiceError if creation fails
   *
   * @example
   * ```typescript
   * const message = await messageRepository.create({
   *   workspaceId: 'workspace-uuid',
   *   channelId: 'channel-uuid',
   *   userId: 'user-uuid',
   *   content: 'Hello team!'
   * });
   * ```
   */
  create(data: CreateMessageData): Promise<MessageResponse>;

  /**
   * Get messages with cursor-based pagination
   *
   * Returns messages before or after a cursor based on direction parameter
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param cursor - Message number to paginate from
   * @param limit - Maximum number of messages to return (+ 1 to check hasMore)
   * @param direction - PaginationDirection.BEFORE for older messages (DESC), PaginationDirection.AFTER for newer messages (ASC)
   * @returns Array of messages
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * // Get older messages (scroll up)
   * const olderMessages = await messageRepository.getMessagesWithCursor(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   1000,
   *   50,
   *   PaginationDirection.BEFORE
   * );
   * // Returns messages 999, 998, 997, ... (up to 50 messages)
   *
   * // Get newer messages (scroll down)
   * const newerMessages = await messageRepository.getMessagesWithCursor(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   1000,
   *   50,
   *   PaginationDirection.AFTER
   * );
   * // Returns messages 1001, 1002, 1003, ... (up to 50 messages)
   * ```
   */
  getMessagesWithCursor(
    workspaceId: string,
    channelId: string,
    cursor: number,
    limit: number,
    direction: PaginationDirection
  ): Promise<MessageResponse[]>;
}
