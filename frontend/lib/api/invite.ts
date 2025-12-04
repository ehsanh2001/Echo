/**
 * Invite API Client
 * Handles all invite-related API calls to the BFF service
 */

import { apiClient } from "./client";
import {
  CreateInviteRequest,
  CreateInviteResponse,
  AcceptInviteRequest,
  AcceptInviteResponse,
} from "@/types/invite";

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

/**
 * Accept a workspace invite
 * @param data - Accept invite data containing token
 * @returns Promise with workspace and channels data
 */
export async function acceptWorkspaceInvite(
  data: AcceptInviteRequest
): Promise<AcceptInviteResponse> {
  try {
    const response = await apiClient.post<AcceptInviteResponse>(
      `/api/workspaces/invites/accept`,
      data
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}
