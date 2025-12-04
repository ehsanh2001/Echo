import {
  CreateWorkspaceRequest,
  WorkspaceResponse,
  WorkspaceDetailsResponse,
  AcceptInviteResponse,
  UserMembershipsResponse,
} from "../../types";

/**
 * Interface for workspace service operations
 * Currently implements: Create Workspace user story
 */
export interface IWorkspaceService {
  /**
   * Create a new workspace
   * - Validates request data
   * - Ensures user exists and is active (with resilient fallback)
   * - Creates workspace with user as owner
   * - Creates default "general" channel
   * - Adds creator as workspace and channel member
   */
  createWorkspace(
    userId: string,
    request: CreateWorkspaceRequest
  ): Promise<WorkspaceResponse>;

  /**
   * Check if workspace name is available
   */
  isNameAvailable(name: string): Promise<boolean>;

  /**
   * Get workspace details for a member
   * - Validates user is an active member
   * - Returns workspace details with user's role
   * - Includes member count
   */
  getWorkspaceDetails(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceDetailsResponse>;

  /**
   * Accept workspace invite
   * - Validates invite token
   * - Validates invite email matches user email
   * - Checks invite is not expired
   * - Checks workspace is not archived
   * - Adds user to workspace
   * - Adds user to all public channels
   * - Marks invite as accepted
   * All operations are atomic (in a transaction)
   */
  acceptInvite(
    token: string,
    userId: string,
    userEmail: string
  ): Promise<AcceptInviteResponse>;

  /**
   * Get all workspaces and optionally channels that a user is a member of
   * - Returns only active memberships
   * - Excludes archived channels and direct channels
   * - Results sorted alphabetically
   */
  getUserMemberships(
    userId: string,
    includeChannels?: boolean
  ): Promise<UserMembershipsResponse>;
}
