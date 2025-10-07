import {
  CreateWorkspaceRequest,
  WorkspaceResponse,
  WorkspaceDetailsResponse,
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
}
