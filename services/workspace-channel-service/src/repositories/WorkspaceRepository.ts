import { injectable, inject } from "tsyringe";
import { PrismaClient, Workspace, WorkspaceMember } from "@prisma/client";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { CreateWorkspaceData, CreateWorkspaceMemberData } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Prisma implementation of workspace repository
 * Currently implements: Create Workspace user story
 */
@injectable()
export class WorkspaceRepository implements IWorkspaceRepository {
  constructor(@inject(PrismaClient) private prisma: PrismaClient) {}

  async create(data: CreateWorkspaceData): Promise<Workspace> {
    try {
      return await this.prisma.workspace.create({
        data: {
          name: data.name,
          displayName: data.displayName,
          description: data.description || null,
          ownerId: data.ownerId,
          settings: data.settings || {},
        },
      });
    } catch (error: any) {
      console.error("Error creating workspace:", error);

      // Handle unique constraint violations
      if (error.code === "P2002") {
        const target = error.meta?.target;
        if (target?.includes("name")) {
          throw WorkspaceChannelServiceError.conflict(
            `Workspace name '${data.name}' is already taken`,
            { field: "name", value: data.name }
          );
        }
        if (target?.includes("display_name")) {
          throw WorkspaceChannelServiceError.conflict(
            `Workspace display name '${data.displayName}' is already taken`,
            { field: "displayName", value: data.displayName }
          );
        }
      }

      throw WorkspaceChannelServiceError.database(
        `Failed to create workspace: ${error.message}`,
        { originalError: error.code }
      );
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
      console.error("Error adding workspace member:", error);

      // Handle unique constraint violations
      if (error.code === "P2002") {
        throw WorkspaceChannelServiceError.conflict(
          "User is already a member of this workspace",
          { workspaceId: data.workspaceId, userId: data.userId }
        );
      }

      throw WorkspaceChannelServiceError.database(
        `Failed to add workspace member: ${error.message}`,
        { originalError: error.code }
      );
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
}
