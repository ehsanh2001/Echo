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
}
