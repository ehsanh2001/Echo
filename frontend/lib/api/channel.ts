/**
 * Channel API Client
 * Handles all channel-related API calls to the BFF service
 */

import { apiClient } from "./client";
import type {
  CreateChannelRequest,
  CreateChannelResponse,
  CheckChannelNameResponse,
  DeleteChannelResponse,
} from "@/types/workspace";

/**
 * Check if a channel name is available within a workspace
 * @param workspaceId - The workspace ID
 * @param name - The channel name to check
 * @returns Promise with availability status
 */
export async function checkChannelName(
  workspaceId: string,
  name: string
): Promise<CheckChannelNameResponse> {
  try {
    const response = await apiClient.get<CheckChannelNameResponse>(
      `/api/workspaces/${workspaceId}/channels/check-name/${encodeURIComponent(name)}`
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Create a new channel in a workspace
 * @param data - Channel creation data
 * @returns Promise with created channel data
 */
export async function createChannel(
  data: CreateChannelRequest
): Promise<CreateChannelResponse> {
  try {
    const response = await apiClient.post<CreateChannelResponse>(
      `/api/workspaces/${data.workspaceId}/channels`,
      data
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Delete a channel from a workspace
 * Only channel owner or workspace owner can delete a channel.
 * The "general" channel cannot be deleted.
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID to delete
 * @returns Promise with deletion confirmation
 */
export async function deleteChannel(
  workspaceId: string,
  channelId: string
): Promise<DeleteChannelResponse> {
  try {
    const response = await apiClient.delete<DeleteChannelResponse>(
      `/api/workspaces/${workspaceId}/channels/${channelId}`
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}
