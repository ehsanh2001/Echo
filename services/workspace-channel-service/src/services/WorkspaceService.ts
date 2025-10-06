import { injectable, inject } from "tsyringe";
import { Workspace } from "@prisma/client";
import { IWorkspaceService } from "../interfaces/services/IWorkspaceService";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { UserServiceClient } from "./userServiceClient";
import {
  CreateWorkspaceRequest,
  WorkspaceResponse,
  CreateWorkspaceData,
} from "../types";
import {
  validateCreateWorkspaceRequest,
  throwIfValidationErrors,
} from "../utils/validation";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Service for workspace operations
 */
@injectable()
export class WorkspaceService implements IWorkspaceService {
  constructor(
    @inject("IWorkspaceRepository")
    private workspaceRepository: IWorkspaceRepository,
    @inject("IChannelRepository") private channelRepository: IChannelRepository,
    @inject("UserServiceClient") private userServiceClient: UserServiceClient
  ) {}

  /**
   * Creates a new workspace with default channel and memberships.
   *
   * **Error Handling Strategy:**
   * This method follows a fail-fast pattern using exceptions. Each step (validation,
   * verification, creation) may throw WorkspaceChannelServiceError to indicate failure.
   *
   * @param userId - The ID of the user creating the workspace
   * @param request - The workspace creation request data
   * @throws {WorkspaceChannelServiceError} On validation, verification, or creation failure
   * @returns {Promise<WorkspaceResponse>} The created workspace details
   */
  async createWorkspace(
    userId: string,
    request: CreateWorkspaceRequest
  ): Promise<WorkspaceResponse> {
    try {
      console.log(`📝 Creating workspace for user: ${userId}`);

      // Validate request data
      await this.validateWorkspaceCreationRequest(request);

      // Check user existence (with resilient fallback)
      await this.verifyUserCanCreateWorkspace(userId);

      // Prepare workspace data
      const workspaceData = this.prepareWorkspaceData(userId, request);

      // Create workspace with default channel and memberships
      const workspace = await this.workspaceRepository.create(
        workspaceData,
        userId
      );

      console.log(
        `✅ Workspace created successfully: ${workspace.name} (${workspace.id})`
      );

      return this.mapWorkspaceToResponse(workspace);
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      console.error("Error creating workspace:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to create workspace due to unexpected error"
      );
    }
  }

  /**
   * Checks if a workspace name is available (not already taken).
   *
   * @param name - The workspace name to check
   * @returns {Promise<boolean>} True if name is available, false if taken
   */
  async isNameAvailable(name: string): Promise<boolean> {
    try {
      const sanitizedName = this.sanitizeWorkspaceName(name);

      const existingWorkspace = await this.workspaceRepository.findByName(
        sanitizedName
      );
      return existingWorkspace === null;
    } catch (error) {
      console.error("Error checking workspace name availability:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to check name availability"
      );
    }
  }

  /**
   * Validates workspace creation request data.
   *
   * **Exception-based validation pattern:**
   * This method uses exceptions (not return values) to indicate validation failures.
   * If validation passes, the method returns normally (void). If validation fails,
   * it throws a WorkspaceChannelServiceError with appropriate details.
   *
   *
   * @param request - The workspace creation request to validate
   * @throws {WorkspaceChannelServiceError} If validation fails (invalid data)
   * @returns {Promise<void>} Resolves if validation passes, rejects if validation fails
   */
  private async validateWorkspaceCreationRequest(
    request: CreateWorkspaceRequest
  ): Promise<void> {
    // Basic validation
    const validationErrors = validateCreateWorkspaceRequest(request);
    throwIfValidationErrors(
      validationErrors,
      "Invalid workspace creation request"
    );

    // Database unique constraints will handle name and displayName uniqueness
    // No need for pre-validation - let the database enforce constraints
  }

  /**
   * Verifies user exists and can create workspaces (with resilient fallback).
   *
   * **Exception-based verification pattern:**
   *
   * **Behavior:**
   * - User found → Returns normally (void)
   * - User service unavailable → Logs warning and returns normally (resilient fallback)
   * - User not found → Throws WorkspaceChannelServiceError
   * - Invalid userId format → Throws WorkspaceChannelServiceError
   *
   * @param userId - The ID of the user to verify
   * @throws {WorkspaceChannelServiceError} If user not found or validation fails
   * @returns {Promise<void>} Resolves if user is verified or service unavailable, rejects otherwise
   */
  private async verifyUserCanCreateWorkspace(userId: string): Promise<void> {
    try {
      // Verify user exists using user-service
      const userInfo = await this.userServiceClient.checkUserExistsById(userId);

      // If userInfo is null, it means user-service was down but we're proceeding
      if (userInfo !== null) {
        console.log(`✅ User verified: ${userInfo.email}`);
      } else {
        console.log(
          `⚠️ User verification skipped (service unavailable), proceeding with userId: ${userId}`
        );
      }
    } catch (error) {
      // UserServiceClient throws errors for user not found or validation issues
      throw error;
    }
  }

  /**
   * Generates a user-friendly display name from the workspace name.
   *
   * **Business Logic:**
   * If a display name is provided, use it (after trimming).
   * Otherwise, transform the workspace name by:
   * - Replacing dots, underscores, and hyphens with spaces
   * - Converting to title case
   *
   * @param name - The sanitized workspace name
   * @param providedDisplayName - Optional user-provided display name
   * @returns The display name to use
   * @example
   * generateDisplayName("my-workspace", undefined) // → "My Workspace"
   * generateDisplayName("my.workspace", "My Team") // → "My Team"
   */
  private generateDisplayName(
    name: string,
    providedDisplayName?: string
  ): string | null {
    if (providedDisplayName && providedDisplayName.trim().length > 0) {
      return providedDisplayName.trim();
    }

    // Convert name to a more readable display name
    // Replace dots, underscores, hyphens with spaces and title case
    return name
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  /**
   * Sanitizes workspace name by trimming and converting to lowercase.
   *
   *
   * @param name - The raw workspace name from user input
   * @returns Sanitized name (trimmed and lowercase)
   * @example
   * sanitizeWorkspaceName("  My-Workspace  ") // → "my-workspace"
   */
  private sanitizeWorkspaceName(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * Prepares workspace data from request.
   *
   * Sanitizes the workspace name and generates/uses the display name.
   *
   * @param userId - The ID of the user creating the workspace
   * @param request - The workspace creation request
   * @returns Prepared workspace data ready for repository
   */
  private prepareWorkspaceData(
    userId: string,
    request: CreateWorkspaceRequest
  ): CreateWorkspaceData {
    const sanitizedName = this.sanitizeWorkspaceName(request.name);
    const displayName = this.generateDisplayName(
      sanitizedName,
      request.displayName
    );

    // Prepare description - use null if not provided (matches Prisma schema)
    const trimmedDescription = request.description?.trim();
    const description = trimmedDescription || null;

    return {
      name: sanitizedName,
      displayName,
      description,
      ownerId: userId,
      settings: {},
    };
  }

  /**
   * Maps database workspace to response format
   * Properly handles nullable fields from Prisma schema
   */
  private mapWorkspaceToResponse(workspace: Workspace): WorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      displayName: workspace.displayName,
      description: workspace.description,
      ownerId: workspace.ownerId,
      isArchived: workspace.isArchived,
      maxMembers: workspace.maxMembers,
      isPublic: workspace.isPublic,
      vanityUrl: workspace.vanityUrl,
      settings: workspace.settings,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
