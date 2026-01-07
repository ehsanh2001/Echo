import { ReadReceiptResponse, ChannelUnreadInfo } from "../../types";

/**
 * Interface for read receipt repository operations
 *
 * Handles data access layer for channel read receipts in PostgreSQL.
 * Read receipts track the last message each user has read in each channel.
 */
export interface IReadReceiptRepository {
  /**
   * Upsert (create or update) a user's read receipt for a channel
   *
   * Updates the user's last read position to the specified messageNo.
   * If no receipt exists, creates a new one. If it exists, updates it
   * only if the new messageNo is greater than the current one.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - User UUID
   * @param messageNo - The message number to mark as last read
   * @param messageId - Optional message UUID for the last read message
   * @returns The updated or created read receipt
   * @throws MessageServiceError if database operation fails
   *
   * @example
   * ```typescript
   * const receipt = await readReceiptRepository.upsertReadReceipt(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   'user-uuid',
   *   150
   * );
   * ```
   */
  upsertReadReceipt(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageNo: number,
    messageId?: string
  ): Promise<ReadReceiptResponse>;

  /**
   * Get a user's read receipt for a specific channel
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - User UUID
   * @returns The read receipt if found, null otherwise
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const receipt = await readReceiptRepository.getReadReceipt(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   'user-uuid'
   * );
   * if (receipt) {
   *   console.log('Last read message:', receipt.lastReadMessageNo);
   * }
   * ```
   */
  getReadReceipt(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ReadReceiptResponse | null>;

  /**
   * Get all read receipts for a user in a workspace
   *
   * Returns read receipts for all channels the user has visited
   * in the specified workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param userId - User UUID
   * @returns Array of read receipts for channels in the workspace
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const receipts = await readReceiptRepository.getReadReceiptsForUser(
   *   'workspace-uuid',
   *   'user-uuid'
   * );
   * // Returns receipts for all channels user has visited
   * ```
   */
  getReadReceiptsForUser(
    workspaceId: string,
    userId: string
  ): Promise<ReadReceiptResponse[]>;

  /**
   * Get unread counts for all channels in a workspace for a user
   *
   * Joins read receipts with channel sequences to calculate unread
   * message counts per channel. Returns only channels with activity.
   *
   * @param workspaceId - Workspace UUID
   * @param userId - User UUID
   * @param channelIds - Array of channel IDs the user is a member of
   * @returns Array of channel unread info with counts
   * @throws MessageServiceError if query fails
   *
   * @example
   * ```typescript
   * const unreadCounts = await readReceiptRepository.getUnreadCountsForUser(
   *   'workspace-uuid',
   *   'user-uuid',
   *   ['channel-1', 'channel-2', 'channel-3']
   * );
   * // Returns: [{ channelId: 'channel-1', unreadCount: 5, ... }, ...]
   * ```
   */
  getUnreadCountsForUser(
    workspaceId: string,
    userId: string,
    channelIds: string[]
  ): Promise<ChannelUnreadInfo[]>;

  /**
   * Delete all read receipts for a channel
   *
   * Called when a channel is deleted to clean up associated data.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @returns Number of receipts deleted
   * @throws MessageServiceError if deletion fails
   */
  deleteByChannelId(workspaceId: string, channelId: string): Promise<number>;

  /**
   * Delete all read receipts for a workspace
   *
   * Called when a workspace is deleted to clean up associated data.
   *
   * @param workspaceId - Workspace UUID
   * @returns Number of receipts deleted
   * @throws MessageServiceError if deletion fails
   */
  deleteByWorkspaceId(workspaceId: string): Promise<number>;
}
