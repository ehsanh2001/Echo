import { Workspace, WorkspaceMember } from "@prisma/client";
import {
  CreateWorkspaceData,
  CreateWorkspaceMemberData,
  WorkspaceMemberData,
} from "../../types";
import { PrismaTransaction } from "./IOutboxRepository";

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

  /**
   * Finds all workspaces where the user is an active member.
   * Results are sorted alphabetically by workspace name.
   *
   * @param userId - The user ID
   * @returns {Promise<Array<{workspace: Workspace, memberCount: number, userRole: string}>>}
   */
  findWorkspacesByUserId(userId: string): Promise<
    Array<{
      workspace: Workspace;
      memberCount: number;
      userRole: string;
    }>
  >;

  /**
   * Gets members of a workspace.
   * By default, only returns active members (isActive: true).
   * Workspace owners/admins can see all members by setting includeInactive to true.
   * Results are sorted by joinedAt in ascending order.
   *
   * @param workspaceId - The workspace ID
   * @param includeInactive - Whether to include inactive members (for admins/owners)
   * @returns {Promise<Array<{userId: string, role: string, joinedAt: Date, isActive: boolean}>>}
   */
  getMembers(
    workspaceId: string,
    includeInactive?: boolean
  ): Promise<
    Array<{
      userId: string;
      role: string;
      joinedAt: Date;
      isActive: boolean;
    }>
  >;

  /**
   * Deletes a workspace and all associated data in a single transaction.
   * Cascading deletes handle:
   * - workspace_members
   * - channels → channel_members
   * - invites
   *
   *
   * @param workspaceId - The workspace ID to delete
   * @param tx - Prisma transaction context
   * @returns Promise resolving when deletion is complete
   */
  deleteWorkspace(workspaceId: string, tx: PrismaTransaction): Promise<void>;

  /**
   * Gets all channel IDs for a workspace.
   * Used before workspace deletion to get channel list for Socket.IO room cleanup.
   *
   * @param workspaceId - The workspace ID
   * @returns Promise resolving to array of channel IDs
   */
  getChannelIds(workspaceId: string): Promise<string[]>;
}
