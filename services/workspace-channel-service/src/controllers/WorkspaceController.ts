import { Request, Response } from "express";
import { container } from "tsyringe";
import { IWorkspaceService } from "../interfaces/services/IWorkspaceService";
import { IInviteService } from "../interfaces/services/IInviteService";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { AuthenticatedRequest } from "../middleware/jwtAuth";
import {
  CreateWorkspaceRequest,
  AcceptInviteRequest,
  CreateWorkspaceInviteRequest,
} from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";
import { WorkspaceRole } from "@prisma/client";
import { config } from "../config/env";

/**
 * Controller for workspace operations
 * Controllers are instantiated directly since they typically have single implementations
 */
export class WorkspaceController {
  private readonly workspaceService: IWorkspaceService;
  private readonly inviteService: IInviteService;
  private readonly workspaceRepository: IWorkspaceRepository;

  constructor() {
    // Resolve dependencies from container
    this.workspaceService =
      container.resolve<IWorkspaceService>("IWorkspaceService");
    this.inviteService = container.resolve<IInviteService>("IInviteService");
    this.workspaceRepository = container.resolve<IWorkspaceRepository>(
      "IWorkspaceRepository"
    );
  }

  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  async createWorkspace(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      console.log(`📝 Create workspace request from user: ${req.user.userId}`);

      const requestData = this.validateCreateWorkspaceRequest(req.body);

      const workspace = await this.workspaceService.createWorkspace(
        req.user.userId,
        requestData
      );

      res.status(201).json({
        success: true,
        data: workspace,
        message: "Workspace created successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("createWorkspace", error, res);
    }
  }

  /**
   * Check if workspace name is available
   * GET /api/workspaces/check-name/:name
   */
  async checkNameAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      if (!name || typeof name !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Workspace name is required"
        );
      }

      const isAvailable = await this.workspaceService.isNameAvailable(name);

      res.status(200).json({
        success: true,
        data: {
          name,
          isAvailable,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("checkNameAvailability", error, res);
    }
  }

  /**
   * Get workspace details
   * GET /api/workspaces/:workspaceId
   *
   * User Story: View Workspace Info (1.4)
   * Protected endpoint - requires JWT authentication
   * Returns workspace details with user's role and member count
   */
  async getWorkspaceDetails(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId || typeof workspaceId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Workspace ID is required"
        );
      }

      console.log(
        `📋 Get workspace details request from user: ${req.user.userId} for workspace: ${workspaceId}`
      );

      const workspaceDetails = await this.workspaceService.getWorkspaceDetails(
        req.user.userId,
        workspaceId
      );

      res.status(200).json({
        success: true,
        data: workspaceDetails,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("getWorkspaceDetails", error, res);
    }
  }

  /**
   * Accept workspace invite
   * POST /api/workspaces/invites/accept
   *
   * Protected endpoint - requires JWT authentication
   * Accepts an invite token and adds user to workspace and all public channels
   */
  async acceptInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Invite token is required"
        );
      }

      console.log(
        `Accept invite request from user: ${
          req.user.userId
        } with token: ${token.substring(0, 10)}...`
      );

      const result = await this.workspaceService.acceptInvite(
        token,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Workspace invite accepted successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("acceptInvite", error, res);
    }
  }

  /**
   * Create a workspace invite
   * POST /api/ws-ch/workspaces/:workspaceId/invites
   *
   * Authorization: Only workspace owners and admins can create invites
   * Protected endpoint - requires JWT authentication
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

      console.log(
        `📬 Create workspace invite request from user: ${userId} for workspace: ${workspaceId}`
      );

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
   * Validates and extracts create workspace request body
   *
   * Controller-level validation focuses on:
   * - HTTP request format validation
   * - Basic type checking
   * - Required field presence
   *
   * Business rule validation (format, length, etc.) is handled by the service layer
   */
  private validateCreateWorkspaceRequest(body: any): CreateWorkspaceRequest {
    // Basic request structure validation
    if (!body || typeof body !== "object") {
      throw WorkspaceChannelServiceError.badRequest("Request body is required");
    }

    // Type checking for all fields - service layer will validate business rules
    if (body.name !== undefined && typeof body.name !== "string") {
      throw WorkspaceChannelServiceError.badRequest(
        "Workspace name must be a string"
      );
    }

    if (
      body.displayName !== undefined &&
      typeof body.displayName !== "string"
    ) {
      throw WorkspaceChannelServiceError.badRequest(
        "Display name must be a string"
      );
    }

    if (
      body.description !== undefined &&
      typeof body.description !== "string"
    ) {
      throw WorkspaceChannelServiceError.badRequest(
        "Description must be a string"
      );
    }

    // Build request object - service layer will validate business rules (required, format, length, etc.)
    const request: CreateWorkspaceRequest = {
      name: body.name,
    };

    if (body.displayName !== undefined) {
      request.displayName = body.displayName;
    }

    if (body.description !== undefined) {
      request.description = body.description;
    }

    return request;
  }

  /**
   * Get user's workspace and channel memberships
   * GET /api/ws-ch/me/memberships?includeChannels=true
   */
  async getUserMemberships(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      console.log(`📝 Get memberships request from user: ${req.user.userId}`);

      // Parse includeChannels query parameter (defaults to false)
      const includeChannels =
        req.query.includeChannels === "true" ||
        req.query.includeChannels === "1";

      const memberships = await this.workspaceService.getUserMemberships(
        req.user.userId,
        includeChannels
      );

      res.status(200).json({
        success: true,
        data: memberships,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("getUserMemberships", error, res);
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
    console.error(`❌ Error in WorkspaceController.${method}:`, error);

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
