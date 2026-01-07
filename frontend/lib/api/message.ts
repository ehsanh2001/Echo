"use client";

import { apiClient } from "./client";
import type {
  SendMessageRequest,
  SendMessageResponse,
  MessageHistoryParams,
  GetMessageHistoryResponse,
  GetMessageByIdResponse,
  MarkAsReadRequest,
  ReadReceiptApiResponse,
  WorkspaceUnreadCountsApiResponse,
} from "@/types/message";

/**
 * Message API functions
 *
 * Handles all message-related API calls to the BFF service.
 */

/**
 * Send a message to a channel
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @param data - Message content and optional threading info
 * @returns Promise with the created message including author info
 *
 * @example
 * ```typescript
 * const response = await sendMessage(
 *   'workspace-123',
 *   'channel-456',
 *   { content: 'Hello world!' }
 * );
 * console.log(response.data.id); // Message ID
 * ```
 */
export async function sendMessage(
  workspaceId: string,
  channelId: string,
  data: SendMessageRequest
): Promise<SendMessageResponse> {
  try {
    const response = await apiClient.post<SendMessageResponse>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/messages`,
      data
    );
    return response;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

/**
 * Get message history for a channel with cursor-based pagination
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @param params - Optional pagination parameters (cursor, limit, direction)
 * @returns Promise with message history and pagination cursors
 *
 * @example
 * ```typescript
 * // Get latest 50 messages (default)
 * const latest = await getMessageHistory(workspaceId, channelId);
 *
 * // Get 25 older messages before message #100
 * const older = await getMessageHistory(workspaceId, channelId, {
 *   cursor: 100,
 *   limit: 25,
 *   direction: PaginationDirection.BEFORE
 * });
 *
 * // Load more using prevCursor from previous response
 * const next = await getMessageHistory(workspaceId, channelId, {
 *   cursor: previous.data.prevCursor,
 *   direction: PaginationDirection.BEFORE
 * });
 * ```
 */
export async function getMessageHistory(
  workspaceId: string,
  channelId: string,
  params?: MessageHistoryParams
): Promise<GetMessageHistoryResponse> {
  try {
    const response = await apiClient.get<GetMessageHistoryResponse>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/messages`,
      { params }
    );
    return response;
  } catch (error) {
    console.error("Error fetching message history:", error);
    throw error;
  }
}

/**
 * Get a single message by ID
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @param messageId - The message ID (UUID)
 * @returns Promise with the message including author info
 *
 * @example
 * ```typescript
 * const response = await getMessageById(
 *   'workspace-123',
 *   'channel-456',
 *   'message-789'
 * );
 * console.log(response.data.content); // Message content
 * ```
 */
export async function getMessageById(
  workspaceId: string,
  channelId: string,
  messageId: string
): Promise<GetMessageByIdResponse> {
  try {
    const response = await apiClient.get<GetMessageByIdResponse>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}`
    );
    return response;
  } catch (error) {
    console.error("Error fetching message by ID:", error);
    throw error;
  }
}

// ===== READ RECEIPT API FUNCTIONS =====

/**
 * Mark messages as read in a channel
 *
 * Updates the user's read position to the specified message number.
 * Only updates if the new position is ahead of the current position.
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @param data - Mark as read request with messageNo and optional messageId
 * @returns Promise with the updated read receipt
 *
 * @example
 * ```typescript
 * await markChannelAsRead('workspace-123', 'channel-456', {
 *   messageNo: 150,
 *   messageId: 'message-uuid'
 * });
 * ```
 */
export async function markChannelAsRead(
  workspaceId: string,
  channelId: string,
  data: MarkAsReadRequest
): Promise<ReadReceiptApiResponse> {
  try {
    const response = await apiClient.post<ReadReceiptApiResponse>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/read-receipt`,
      data
    );
    return response;
  } catch (error) {
    console.error("Error marking channel as read:", error);
    throw error;
  }
}

/**
 * Get the user's read receipt for a channel
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @returns Promise with the read receipt (or null if never read)
 *
 * @example
 * ```typescript
 * const receipt = await getReadReceipt('workspace-123', 'channel-456');
 * if (receipt.data) {
 *   console.log('Last read message:', receipt.data.lastReadMessageNo);
 * }
 * ```
 */
export async function getReadReceipt(
  workspaceId: string,
  channelId: string
): Promise<ReadReceiptApiResponse> {
  try {
    const response = await apiClient.get<ReadReceiptApiResponse>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/read-receipt`
    );
    return response;
  } catch (error) {
    console.error("Error fetching read receipt:", error);
    throw error;
  }
}

/**
 * Get unread counts for all channels in a workspace
 *
 * Fetches unread message counts for the specified channels.
 * Should be called with all channel IDs the user is a member of.
 *
 * @param workspaceId - The workspace ID
 * @param channelIds - Array of channel IDs to get unread counts for
 * @returns Promise with unread counts per channel and total
 *
 * @example
 * ```typescript
 * const counts = await getWorkspaceUnreadCounts(
 *   'workspace-123',
 *   ['channel-1', 'channel-2', 'channel-3']
 * );
 * console.log('Total unread:', counts.data.totalUnread);
 * counts.data.channels.forEach(ch => {
 *   console.log(`${ch.channelId}: ${ch.unreadCount} unread`);
 * });
 * ```
 */
export async function getWorkspaceUnreadCounts(
  workspaceId: string,
  channelIds: string[]
): Promise<WorkspaceUnreadCountsApiResponse> {
  try {
    const response = await apiClient.get<WorkspaceUnreadCountsApiResponse>(
      `/api/workspaces/${workspaceId}/unread-counts`,
      {
        params: {
          channelIds: channelIds.join(","),
        },
      }
    );
    return response;
  } catch (error) {
    console.error("Error fetching workspace unread counts:", error);
    throw error;
  }
}
