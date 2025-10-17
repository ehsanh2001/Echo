import { Workspace, WorkspaceMember } from "@prisma/client";
import { CreateWorkspaceData, CreateWorkspaceMemberData } from "../../types";

/**
 * Interface for workspace repository operations
 */
export interface IWorkspaceRepository {
  /**
   * Creates a complete workspace with default channel and memberships in a single transaction.
   *
   * This method atomically performs:
   * 1. Creates the workspace
   * 2. Adds the creator as workspace owner
   * 3. Creates default "general" channel with creator as owner (via ChannelRepository.create)
   *
   * All operations execute in a database transaction - if any step fails,
   * all changes are rolled back automatically.
   *
   * @param data - The workspace data to create
   * @param ownerId - The ID of the user who will own the workspace and default channel
   * @throws {WorkspaceChannelServiceError} If any operation fails (transaction rolled back)
   * @returns {Promise<Workspace>} The created workspace
   */
  create(data: CreateWorkspaceData, ownerId: string): Promise<Workspace>;

  /**
   * Adds a member to an existing workspace.
   *
   * @param data - The workspace member data
   * @throws {WorkspaceChannelServiceError} If member already exists or workspace not found
   * @returns {Promise<WorkspaceMember>} The created membership
   */
  addMember(data: CreateWorkspaceMemberData): Promise<WorkspaceMember>;

  /**
   * Finds a workspace by its unique name.
   *
   * @param name - The workspace name to search for
   * @returns {Promise<Workspace | null>} The workspace if found, null otherwise
   */
  findByName(name: string): Promise<Workspace | null>;

  /**
   * Finds a workspace by its ID.
   *
   * @param id - The workspace ID to search for
   * @returns {Promise<Workspace | null>} The workspace if found, null otherwise
   */
  findById(id: string): Promise<Workspace | null>;

  /**
   * Gets a user's membership in a workspace.
   *
   * @param userId - The user ID
   * @param workspaceId - The workspace ID
   * @returns {Promise<WorkspaceMember | null>} The membership if found, null otherwise
   */
  getMembership(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceMember | null>;

  /**
   * Counts the number of active members in a workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns {Promise<number>} The count of active members
   */
  countActiveMembers(workspaceId: string): Promise<number>;

  /**
   * Adds a member to a workspace or reactivates an inactive membership.
   * Supports transaction context for atomic operations.
   *
   * @param workspaceId - The workspace ID
   * @param userId - The user ID to add
   * @param role - The role to assign (default: 'member')
   * @param invitedBy - Optional user ID who invited this member
   * @param transaction - Optional Prisma transaction context
   * @returns {Promise<WorkspaceMember>} The created or reactivated membership
   */
  addOrReactivateMember(
    workspaceId: string,
    userId: string,
    role: string,
    invitedBy: string | null,
    transaction?: any
  ): Promise<WorkspaceMember>;
}
