import { Response } from "express";
import { container } from "tsyringe";
import { IChannelService } from "../interfaces/services/IChannelService";
import { AuthenticatedRequest } from "../middleware/jwtAuth";
import { CreateChannelRequest, ChannelType } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Type guard to check if a value is a valid ChannelType
 */
function isValidChannelType(value: string): value is ChannelType {
  return Object.values(ChannelType).includes(value as ChannelType);
}

/**
 * Controller for channel operations
 */
export class ChannelController {
  private readonly channelService: IChannelService;

  constructor() {
    // Resolve dependencies from container
    this.channelService = container.resolve<IChannelService>("IChannelService");
  }

  /**
   * Create a new channel in a workspace
   * POST /api/ws-ch/workspaces/:workspaceId/channels
   */
  async createChannel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const userId = req.user.userId;

      console.log(
        `Create channel request from user ${userId} in workspace ${workspaceId}`
      );

      // Validate workspace ID
      if (!workspaceId || typeof workspaceId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid workspace ID is required"
        );
      }

      // Validate and parse request body
      const requestData = this.validateCreateChannelRequest(req.body);

      // Create the channel
      const channel = await this.channelService.createChannel(
        workspaceId,
        userId,
        requestData
      );

      console.log(
        `Channel created successfully: ${channel.name} (${channel.id})`
      );

      res.status(201).json({
        success: true,
        data: channel,
        message: "Channel created successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("createChannel", error, res);
    }
  }

  /**
   * Validates the create channel request body
   */
  private validateCreateChannelRequest(body: any): CreateChannelRequest {
    if (!body || typeof body !== "object") {
      throw WorkspaceChannelServiceError.badRequest("Request body is required");
    }

    const { type, name, displayName, description, participants } = body;

    // Validate channel type (required)
    if (!type || typeof type !== "string") {
      throw WorkspaceChannelServiceError.validation(
        "Channel type is required",
        { field: "type" }
      );
    }

    // Validate allowed channel types using type guard
    if (!isValidChannelType(type)) {
      throw WorkspaceChannelServiceError.validation(
        `Channel type must be one of: ${Object.values(ChannelType).join(", ")}`,
        { field: "type", value: type }
      );
    }

    // Validate name if provided
    if (name !== undefined && name !== null && typeof name !== "string") {
      throw WorkspaceChannelServiceError.validation(
        "Channel name must be a string",
        { field: "name", value: name }
      );
    }

    // Validate displayName if provided
    if (
      displayName !== undefined &&
      displayName !== null &&
      typeof displayName !== "string"
    ) {
      throw WorkspaceChannelServiceError.validation(
        "Display name must be a string",
        { field: "displayName", value: displayName }
      );
    }

    // Validate description if provided
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      throw WorkspaceChannelServiceError.validation(
        "Description must be a string",
        { field: "description", value: description }
      );
    }

    // Validate participants if provided
    if (participants !== undefined && participants !== null) {
      if (!Array.isArray(participants)) {
        throw WorkspaceChannelServiceError.validation(
          "Participants must be an array",
          { field: "participants", value: participants }
        );
      }

      // Validate each participant is a string (user ID)
      for (let i = 0; i < participants.length; i++) {
        if (typeof participants[i] !== "string") {
          throw WorkspaceChannelServiceError.validation(
            `Participant at index ${i} must be a string (user ID)`,
            { field: `participants[${i}]`, value: participants[i] }
          );
        }
      }
    }

    return {
      type,
      name,
      displayName,
      description,
      participants,
    };
  }

  /**
   * Centralized error handler for controller methods
   */
  private handleControllerError(
    method: string,
    error: unknown,
    res: Response
  ): void {
    console.error(`Error in ChannelController.${method}:`, error);

    if (error instanceof WorkspaceChannelServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Unknown error
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
