"use client";

import { apiClient } from "./client";
import type {
  SendMessageRequest,
  SendMessageResponse,
  MessageHistoryParams,
  GetMessageHistoryResponse,
  GetMessageByIdResponse,
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
