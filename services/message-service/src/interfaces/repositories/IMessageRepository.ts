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

  /**
   * Delete all messages for a channel
   *
   * Used when a channel is deleted to remove all associated messages.
   * Includes workspaceId for partition-aware queries.
   *
   * @param workspaceId - Workspace UUID (partition key)
   * @param channelId - Channel UUID
   * @returns Number of messages deleted
   * @throws MessageServiceError if deletion fails
   *
   * @example
   * ```typescript
   * const count = await messageRepository.deleteByChannelId(
   *   'workspace-uuid',
   *   'channel-uuid'
   * );
   * console.log(`Deleted ${count} messages`);
   * ```
   */
  deleteByChannelId(workspaceId: string, channelId: string): Promise<number>;

  /**
   * Delete all messages for a workspace
   *
   * Used when a workspace is deleted to remove all messages across all channels.
   * Queries by workspaceId only (partition key) for efficient bulk deletion.
   *
   * @param workspaceId - Workspace UUID (partition key)
   * @returns Number of messages deleted
   * @throws MessageServiceError if deletion fails
   *
   * @example
   * ```typescript
   * const count = await messageRepository.deleteByWorkspaceId('workspace-uuid');
   * console.log(`Deleted ${count} messages across all channels`);
   * ```
   */
  deleteByWorkspaceId(workspaceId: string): Promise<number>;

  /**
   * Get the last message number for a channel
   *
   * Retrieves the current lastMessageNo from the channel_sequences table.
   * Returns 0 if no messages have been sent to the channel.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @returns The last message number (0 if no messages)
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const lastNo = await messageRepository.getChannelLastMessageNo(
   *   'workspace-uuid',
   *   'channel-uuid'
   * );
   * console.log(`Channel has ${lastNo} messages`);
   * ```
   */
  getChannelLastMessageNo(
    workspaceId: string,
    channelId: string
  ): Promise<number>;

  /**
   * Get the last message numbers for multiple channels
   *
   * Batch retrieves lastMessageNo for multiple channels in a single query.
   * Useful for calculating unread counts efficiently.
   *
   * @param workspaceId - Workspace UUID
   * @param channelIds - Array of channel UUIDs
   * @returns Map of channelId to lastMessageNo
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const lastNos = await messageRepository.getChannelsLastMessageNos(
   *   'workspace-uuid',
   *   ['channel-1', 'channel-2']
   * );
   * // Returns Map { 'channel-1' => 150, 'channel-2' => 75 }
   * ```
   */
  getChannelsLastMessageNos(
    workspaceId: string,
    channelIds: string[]
  ): Promise<Map<string, number>>;
}
