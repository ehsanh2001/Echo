"use client";

import { apiClient } from "./client";
import type { SendMessageRequest, SendMessageResponse } from "@/types/message";

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
