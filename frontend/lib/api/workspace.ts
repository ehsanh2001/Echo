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
