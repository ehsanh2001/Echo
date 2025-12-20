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
   * Find a message by its unique ID
   *
   * @param messageId - Message UUID
   * @returns Message if found, null otherwise
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const message = await messageRepository.findById('message-uuid');
   * if (message) {
   *   console.log('Found message:', message.content);
   * }
   * ```
   */
  findById(messageId: string): Promise<MessageResponse | null>;

  /**
   * Get messages with cursor-based pagination
   *
   * Returns messages before or after a cursor based on direction parameter.
   * Always returns messages in ascending order (oldest to newest) by messageNo.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param cursor - Message number to paginate from
   * @param limit - Maximum number of messages to return (+ 1 to check hasMore)
   * @param direction - PaginationDirection.BEFORE for older messages (< cursor), PaginationDirection.AFTER for newer messages (> cursor)
   * @returns Array of messages in ascending order (oldest to newest)
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * // Get older messages (< 1000)
   * const olderMessages = await messageRepository.getMessagesWithCursor(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   1000,
   *   50,
   *   PaginationDirection.BEFORE
   * );
   * // Returns messages in ASC order: [950, 951, 952, ..., 998, 999]
   *
   * // Get newer messages (> 1000)
   * const newerMessages = await messageRepository.getMessagesWithCursor(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   1000,
   *   50,
   *   PaginationDirection.AFTER
   * );
   * // Returns messages in ASC order: [1001, 1002, 1003, ..., 1049, 1050]
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
