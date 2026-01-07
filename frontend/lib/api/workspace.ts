/**
 * Workspace API Client
 * Handles all workspace-related API calls to the BFF service
 */

import { apiClient } from "./client";
import {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  CheckNameAvailabilityResponse,
  GetUserMembershipsResponse,
  GetWorkspaceMembersResponse,
  WorkspaceError,
} from "@/types/workspace";

const WORKSPACE_BASE_URL = "/api/workspaces";

/**
 * Check if a workspace name is available
 * @param name - The workspace name to check
 * @returns Promise with availability status
 */
export async function checkWorkspaceName(
  name: string
): Promise<CheckNameAvailabilityResponse> {
  try {
    const response = await apiClient.get<CheckNameAvailabilityResponse>(
      `${WORKSPACE_BASE_URL}/check-name/${encodeURIComponent(name)}`
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Create a new workspace
 * @param data - Workspace creation data
 * @returns Promise with created workspace data
 */
export async function createWorkspace(
  data: CreateWorkspaceRequest
): Promise<CreateWorkspaceResponse> {
  try {
    const response = await apiClient.post<CreateWorkspaceResponse>(
      WORKSPACE_BASE_URL,
      data
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get workspace details by ID
 * @param workspaceId - The workspace ID
 * @returns Promise with workspace details
 */
export async function getWorkspaceDetails(workspaceId: string) {
  try {
    const response = await apiClient.get(
      `${WORKSPACE_BASE_URL}/${workspaceId}`
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get user's workspace memberships with optional channel data
 *
 * @param includeChannels - Whether to include channel memberships in each workspace
 * @returns Promise with user's workspace memberships
 *
 * Response structure:
 * - workspaces: Array of workspaces the user belongs to
 * - Each workspace includes: workspace details, user's role, member count
 * - If includeChannels=true, each workspace also includes channels array
 * - Each channel includes: channel details + user's membership info (role, joinedAt, etc.)
 */
export async function getUserMemberships(
  includeChannels: boolean = true
): Promise<GetUserMembershipsResponse> {
  try {
    const url = includeChannels
      ? `${WORKSPACE_BASE_URL}/me/memberships?includeChannels=true`
      : `${WORKSPACE_BASE_URL}/me/memberships`;
    const response = await apiClient.get<GetUserMembershipsResponse>(url);
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get workspace members and channel members
 *
 * @param workspaceId - The workspace ID to fetch members for
 * @returns Promise with workspace members and channel members data
 *
 * Response structure:
 * - workspaceId: The workspace ID
 * - workspaceName: The workspace name
 * - workspaceMembers: Array of workspace members with enriched user info
 * - channels: Array of channels the user has access to with their members
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<GetWorkspaceMembersResponse> {
  try {
    const response = await apiClient.get<GetWorkspaceMembersResponse>(
      `${WORKSPACE_BASE_URL}/${workspaceId}/members`
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Delete a workspace
 * Only workspace owners can delete a workspace.
 * Deletes the workspace and all associated data (channels, messages, members, etc.).
 *
 * @param workspaceId - The workspace ID to delete
 * @returns Promise with deletion confirmation
 */
export async function deleteWorkspace(workspaceId: string): Promise<any> {
  try {
    const response = await apiClient.delete(
      `${WORKSPACE_BASE_URL}/${workspaceId}`
    );
    return response;
  } catch (error: any) {
    throw error;
  }
}
