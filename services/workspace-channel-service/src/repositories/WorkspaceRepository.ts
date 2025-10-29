import { injectable, inject } from "tsyringe";
import { PrismaClient, Workspace, WorkspaceMember } from "@prisma/client";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { CreateWorkspaceData, CreateWorkspaceMemberData } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Prisma implementation of workspace repository
 * Currently implements: Create Workspace user story
 */
@injectable()
export class WorkspaceRepository implements IWorkspaceRepository {
  constructor(
    @inject(PrismaClient) private prisma: PrismaClient,
    @inject("IChannelRepository") private channelRepository: IChannelRepository
  ) {}

  /**
   * Handles Prisma errors and converts them to WorkspaceChannelServiceError
   * for workspace-related operations.
   */
  private handleWorkspaceError(
    error: any,
    workspaceData?: CreateWorkspaceData
  ): never {
    console.error("Error in workspace operation:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes("name") && workspaceData) {
        throw WorkspaceChannelServiceError.conflict(
          `Workspace name '${workspaceData.name}' is already taken`,
          { field: "name", value: workspaceData.name }
        );
      }
      if (target?.includes("display_name") && workspaceData) {
        throw WorkspaceChannelServiceError.conflict(
          `Workspace display name '${workspaceData.displayName}' is already taken`,
          { field: "displayName", value: workspaceData.displayName }
        );
      }
    }

    throw WorkspaceChannelServiceError.database(
      `Failed workspace operation: ${error.message}`,
      { originalError: error.code }
    );
  }

  /**
   * Handles Prisma errors for workspace member operations
   */
  private handleMemberError(
    error: any,
    data?: CreateWorkspaceMemberData
  ): never {
    console.error("Error in workspace member operation:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      throw WorkspaceChannelServiceError.conflict(
        "User is already a member of this workspace",
        data
          ? { workspaceId: data.workspaceId, userId: data.userId }
          : undefined
      );
    }

    throw WorkspaceChannelServiceError.database(
      `Failed to add workspace member: ${error.message}`,
      { originalError: error.code }
    );
  }

  async create(data: CreateWorkspaceData, ownerId: string): Promise<Workspace> {
    try {
      // Use Prisma's interactive transaction for atomic operations
      // All operations succeed together or all are rolled back
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create workspace
        const workspace = await tx.workspace.create({
          data: {
            name: data.name,
            displayName: data.displayName ?? null,
            description: data.description ?? null,
            ownerId: ownerId,
            settings: data.settings ?? {},
          },
        });

        // 2. Add creator as workspace owner
        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: ownerId,
            role: "owner",
          },
        });

        // 3. Create default "general" channel with creator as owner
        // Use createInTransaction to share the same transaction context
        // If this fails, the entire workspace creation will be rolled back.
        await this.channelRepository.createInTransaction(
          tx,
          {
            workspaceId: workspace.id,
            name: "general",
            displayName: "General",
            description: "This is the default channel for general discussions",
            type: "public",
            createdBy: ownerId,
            memberCount: 0, // Will be set to 1 by ChannelRepository.create()
            settings: {},
          },
          ownerId
        );

        console.log(`✅ Workspace created with defaults: ${workspace.name}`);
        return workspace;
      });
    } catch (error: any) {
      console.error(
        "Error creating workspace (transaction rolled back):",
        error
      );
      this.handleWorkspaceError(error, data);
    }
  }

  async addMember(data: CreateWorkspaceMemberData): Promise<WorkspaceMember> {
    try {
      return await this.prisma.workspaceMember.create({
        data: {
          workspaceId: data.workspaceId,
          userId: data.userId,
          role: data.role,
          invitedBy: data.invitedBy || null,
        },
      });
    } catch (error: any) {
      this.handleMemberError(error, data);
    }
  }

  async findByName(name: string): Promise<Workspace | null> {
    try {
      return await this.prisma.workspace.findUnique({
        where: { name },
      });
    } catch (error: any) {
      console.error("Error finding workspace by name:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find workspace: ${error.message}`
      );
    }
  }

  /**
   * Finds a workspace by its ID
   */
  async findById(id: string): Promise<Workspace | null> {
    try {
      return await this.prisma.workspace.findUnique({
        where: { id },
      });
    } catch (error: any) {
      console.error("Error finding workspace by ID:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find workspace: ${error.message}`
      );
    }
  }

  /**
   * Gets a user's membership in a workspace
   */
  async getMembership(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceMember | null> {
    try {
      return await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });
    } catch (error: any) {
      console.error("Error finding workspace membership:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find membership: ${error.message}`
      );
    }
  }

  /**
   * Counts the number of active members in a workspace
   */
  async countActiveMembers(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.workspaceMember.count({
        where: {
          workspaceId,
          isActive: true,
        },
      });
    } catch (error: any) {
      console.error("Error counting workspace members:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to count members: ${error.message}`
      );
    }
  }

  /**
   * Adds a member to a workspace or reactivates an inactive membership.
   * Supports transaction context for atomic operations.
   */
  async addOrReactivateMember(
    workspaceId: string,
    userId: string,
    role: string = "member",
    invitedBy: string | null = null,
    transaction?: any
  ): Promise<WorkspaceMember> {
    try {
      const prismaClient = transaction || this.prisma;

      // Upsert the membership (create new or update existing)
      const member = await prismaClient.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
        create: {
          workspaceId,
          userId,
          role: role as any,
          invitedBy,
          isActive: true,
        },
        update: {
          isActive: true,
          role: role as any,
          invitedBy,
        },
      });

      return member;
    } catch (error: any) {
      console.error("Error adding/reactivating workspace member:", error);
      this.handleMemberError(error, {
        workspaceId,
        userId,
        role: role as any,
        invitedBy,
      });
    }
  }

  /**
   * Finds all workspaces where the user is an active member,
   * including workspace details and user's role.
   * Results are sorted alphabetically by workspace name.
   */
  async findWorkspacesByUserId(userId: string): Promise<
    Array<{
      workspace: Workspace;
      memberCount: number;
      userRole: string;
    }>
  > {
    try {
      // Find all active memberships for the user
      const memberships = await this.prisma.workspaceMember.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          workspace: true,
        },
        orderBy: {
          workspace: {
            name: "asc", // Sort alphabetically by workspace name
          },
        },
      });

      // For each workspace, get the member count
      const results = await Promise.all(
        memberships.map(async (membership) => {
          const memberCount = await this.countActiveMembers(
            membership.workspaceId
          );

          return {
            workspace: membership.workspace,
            memberCount,
            userRole: membership.role,
          };
        })
      );

      return results;
    } catch (error: any) {
      console.error("Error finding workspaces by user ID:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find workspaces: ${error.message}`
      );
    }
  }
}
