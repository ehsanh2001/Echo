import { Response } from "express";
import { container } from "tsyringe";
import { IInviteService } from "../interfaces/services/IInviteService";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { WorkspaceChannelServiceError } from "../utils/errors";
import { CreateWorkspaceInviteRequest } from "../types";
import { AuthenticatedRequest } from "../middleware/jwtAuth";
import { WorkspaceRole } from "@prisma/client";
import { config } from "../config/env";

/**
 * InviteController - Handles HTTP requests for workspace invitations
 *
 * Responsibilities:
 * - Request validation
 * - Authorization (check inviter has owner/admin role)
 * - Delegate business logic to InviteService
 * - HTTP response formatting
 * - Error handling
 * Controllers are instantiated directly since they typically have single implementations
 */
export class InviteController {
  private readonly inviteService: IInviteService;
  private readonly workspaceRepository: IWorkspaceRepository;

  constructor() {
    // Resolve dependencies from container
    this.inviteService = container.resolve<IInviteService>("IInviteService");
    this.workspaceRepository = container.resolve<IWorkspaceRepository>(
      "IWorkspaceRepository"
    );
  }

  /**
   * Create a workspace invite
   * POST /workspaces/:workspaceId/invites
   *
   * Authorization: Only workspace owners and admins can create invites
   * Request body: CreateWorkspaceInviteRequest (email, role?, expiresInDays?, customMessage?)
   * Response: 201 Created with WorkspaceInviteResponse
   *
   * @param req - Express request (user from JWT, params, body)
   * @param res - Express response
   */
  async createWorkspaceInvite(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      // 1. Extract authenticated user from JWT
      const userId = req.user.userId;

      // 2. Extract workspaceId from route params
      const { workspaceId } = req.params;

      if (!workspaceId) {
        throw WorkspaceChannelServiceError.badRequest(
          "Workspace ID is required"
        );
      }

      // 3. Extract and validate request body
      const inviteData = req.body as CreateWorkspaceInviteRequest;

      // Basic request validation
      if (!inviteData.email) {
        throw WorkspaceChannelServiceError.validation("Email is required", {
          field: "email",
          message: "Email is required",
          value: inviteData.email,
        });
      }

      // 4. Authorization: Check if user is owner or admin of the workspace
      const membership = await this.workspaceRepository.getMembership(
        workspaceId,
        userId
      );

      if (!membership) {
        throw WorkspaceChannelServiceError.forbidden(
          "You are not a member of this workspace"
        );
      }

      // Check if user has owner or admin role
      if (
        membership.role !== WorkspaceRole.owner &&
        membership.role !== WorkspaceRole.admin
      ) {
        throw WorkspaceChannelServiceError.forbidden(
          "Only workspace owners and admins can create invites"
        );
      }

      // 5. Delegate to service layer
      const invite = await this.inviteService.createWorkspaceInvite(
        workspaceId,
        userId,
        inviteData
      );

      // 6. Send success response
      res.status(201).json({
        success: true,
        data: invite,
        message: "Workspace invite created successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("createWorkspaceInvite", error, res);
    }
  }

  /**
   * Handles controller errors with consistent error response format
   */
  private handleControllerError(
    method: string,
    error: unknown,
    res: Response
  ): void {
    console.error(`❌ Error in InviteController.${method}:`, error);

    if (error instanceof WorkspaceChannelServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        service: config.service.name,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Unexpected error
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            config.nodeEnv === "development"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : "An unexpected error occurred",
        },
        service: config.service.name,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
