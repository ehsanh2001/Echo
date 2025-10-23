import { CreateMessageData, MessageResponse } from "../../types";

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
   * Get messages before a cursor (scroll up to see older messages)
   *
   * Returns messages with messageNo < cursor, ordered by messageNo DESC
   * Used for backward pagination (loading older messages)
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param cursor - Message number to paginate from
   * @param limit - Maximum number of messages to return (+ 1 to check hasMore)
   * @returns Array of messages (excluding archived messages)
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const messages = await messageRepository.getMessagesByChannelWithCursorBefore(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   1000,
   *   50
   * );
   * // Returns messages 999, 998, 997, ... (up to 50 messages)
   * ```
   */
  getMessagesBeforeCursor(
    workspaceId: string,
    channelId: string,
    cursor: number,
    limit: number
  ): Promise<MessageResponse[]>;

  /**
   * Get messages after a cursor (scroll down to see newer messages)
   *
   * Returns messages with messageNo > cursor, ordered by messageNo ASC
   * Used for forward pagination (loading newer messages)
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param cursor - Message number to paginate from
   * @param limit - Maximum number of messages to return (+ 1 to check hasMore)
   * @returns Array of messages (excluding archived messages)
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const messages = await messageRepository.getMessagesByChannelWithCursorAfter(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   1000,
   *   50
   * );
   * // Returns messages 1001, 1002, 1003, ... (up to 50 messages)
   * ```
   */
  getMessagesAfterCursor(
    workspaceId: string,
    channelId: string,
    cursor: number,
    limit: number
  ): Promise<MessageResponse[]>;
}
