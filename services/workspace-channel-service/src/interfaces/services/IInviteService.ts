import {
  CreateWorkspaceInviteRequest,
  WorkspaceInviteResponse,
} from "../../types";

/**
 * Service interface for workspace invite operations
 */
export interface IInviteService {
  /**
   * Create a workspace invite
   * @param workspaceId - The workspace ID to invite to
   * @param inviterId - The user ID of the person creating the invite
   * @param inviteData - The invite creation request data
   * @returns Promise resolving to the created invite response
   */
  createWorkspaceInvite(
    workspaceId: string,
    inviterId: string,
    inviteData: CreateWorkspaceInviteRequest
  ): Promise<WorkspaceInviteResponse>;
}
