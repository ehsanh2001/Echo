import { Request, Response } from "express";
import { container } from "tsyringe";
import { IWorkspaceService } from "../interfaces/services/IWorkspaceService";
import { AuthenticatedRequest } from "../middleware/jwtAuth";
import { CreateWorkspaceRequest } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";
import { config } from "../config/env";

/**
 * Controller for workspace operations
 * Controllers are instantiated directly since they typically have single implementations
 */
export class WorkspaceController {
  private readonly workspaceService: IWorkspaceService;

  constructor() {
    // Resolve dependencies from container
    this.workspaceService =
      container.resolve<IWorkspaceService>("IWorkspaceService");
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
