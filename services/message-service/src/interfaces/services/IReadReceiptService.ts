import {
  ReadReceiptResponse,
  ChannelUnreadInfo,
  WorkspaceUnreadCountsResponse,
} from "../../types";

/**
 * Interface for read receipt service business logic
 *
 * Handles business operations for tracking message read status,
 * including marking messages as read and calculating unread counts.
 */
export interface IReadReceiptService {
  /**
   * Mark messages as read up to a specific message number
   *
   * Updates the user's read position for the channel. Only updates
   * if the new messageNo is greater than the current read position.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - User UUID
   * @param messageNo - The message number to mark as last read
   * @param messageId - Optional message UUID for reference
   * @returns The updated read receipt
   * @throws MessageServiceError for business logic violations
   *
   * @example
   * ```typescript
   * const receipt = await readReceiptService.markAsRead(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   'user-uuid',
   *   150
   * );
   * ```
   */
  markAsRead(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageNo: number,
    messageId?: string
  ): Promise<ReadReceiptResponse>;

  /**
   * Get the user's read receipt for a channel
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - User UUID
   * @returns The read receipt if found, null otherwise
   * @throws MessageServiceError if operation fails
   */
  getReadReceipt(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ReadReceiptResponse | null>;

  /**
   * Get unread count for a specific channel
   *
   * Calculates the number of unread messages by comparing
   * the channel's lastMessageNo with the user's lastReadMessageNo.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param userId - User UUID
   * @returns Unread info with count and message numbers
   * @throws MessageServiceError if calculation fails
   *
   * @example
   * ```typescript
   * const info = await readReceiptService.getUnreadCount(
   *   'workspace-uuid',
   *   'channel-uuid',
   *   'user-uuid'
   * );
   * console.log(`${info.unreadCount} unread messages`);
   * ```
   */
  getUnreadCount(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelUnreadInfo>;

  /**
   * Get unread counts for all channels in a workspace
   *
   * Returns unread counts for all channels the user is a member of
   * in the specified workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param userId - User UUID
   * @param channelIds - Array of channel IDs the user is a member of
   * @returns Workspace unread counts with per-channel breakdown
   * @throws MessageServiceError if calculation fails
   *
   * @example
   * ```typescript
   * const counts = await readReceiptService.getUnreadCountsForWorkspace(
   *   'workspace-uuid',
   *   'user-uuid',
   *   ['channel-1', 'channel-2']
   * );
   * console.log(`Total unread: ${counts.totalUnread}`);
   * ```
   */
  getUnreadCountsForWorkspace(
    workspaceId: string,
    userId: string,
    channelIds: string[]
  ): Promise<WorkspaceUnreadCountsResponse>;

  /**
   * Delete all read receipts for a channel
   *
   * Called when a channel is deleted.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @returns Number of receipts deleted
   */
  deleteReceiptsByChannel(
    workspaceId: string,
    channelId: string
  ): Promise<number>;

  /**
   * Delete all read receipts for a workspace
   *
   * Called when a workspace is deleted.
   *
   * @param workspaceId - Workspace UUID
   * @returns Number of receipts deleted
   */
  deleteReceiptsByWorkspace(workspaceId: string): Promise<number>;
}
