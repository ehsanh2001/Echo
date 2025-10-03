import { Workspace, WorkspaceMember } from "@prisma/client";
import { CreateWorkspaceData, CreateWorkspaceMemberData } from "../../types";

/**
 * Interface for workspace repository operations
 * Currently implements: Create Workspace user story
 */
export interface IWorkspaceRepository {
  create(data: CreateWorkspaceData): Promise<Workspace>;
  addMember(data: CreateWorkspaceMemberData): Promise<WorkspaceMember>;
  findByName(name: string): Promise<Workspace | null>;
}
