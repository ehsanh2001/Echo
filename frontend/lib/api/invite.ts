/**
 * Invite API Client
 * Handles all invite-related API calls to the BFF service
 */

import { apiClient } from "./client";
import { CreateInviteRequest, CreateInviteResponse } from "@/types/invite";

/**
 * Create a workspace invite
 * @param workspaceId - The workspace ID
 * @param data - Invite creation data
 * @returns Promise with created invite data
 */
export async function createWorkspaceInvite(
  workspaceId: string,
  data: CreateInviteRequest
): Promise<CreateInviteResponse> {
  try {
    const response = await apiClient.post<CreateInviteResponse>(
      `/api/workspaces/${workspaceId}/invites`,
      data
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}
