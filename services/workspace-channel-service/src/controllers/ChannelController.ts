import { Request, Response } from "express";
import { container } from "tsyringe";
import logger from "../utils/logger";
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

      logger.info(
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

      logger.info(
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
   * Get a channel member by workspace, channel, and user IDs
   * GET /api/ws-ch/workspaces/:workspaceId/channels/:channelId/members/:userId
   */
  async getChannelMember(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, channelId, userId } = req.params;

      logger.info(
        `Get channel member request for workspace ${workspaceId}, channel ${channelId}, user ${userId}`
      );

      // Validate parameters
      if (!workspaceId || typeof workspaceId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid workspace ID is required"
        );
      }

      if (!channelId || typeof channelId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid channel ID is required"
        );
      }

      if (!userId || typeof userId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid user ID is required"
        );
      }

      // Get the channel member
      const channelMember = await this.channelService.getChannelMember(
        workspaceId,
        channelId,
        userId
      );

      // Return 404 if member not found (as per requirements)
      if (!channelMember) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Channel member not found",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info(
        `Channel member found: ${channelMember.userId} in channel ${channelMember.channelId}`
      );

      res.status(200).json({
        success: true,
        data: channelMember,
        message: "Channel member retrieved successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("getChannelMember", error, res);
    }
  }

  /**
   * Check if a channel name is available in a workspace
   * GET /api/ws-ch/workspaces/:workspaceId/channels/check-name/:name
   */
  async checkChannelNameAvailability(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { workspaceId, name } = req.params;

      logger.info(
        `Check channel name availability request for workspace ${workspaceId}, name: ${name}`
      );

      // Validate workspace ID
      if (!workspaceId || typeof workspaceId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid workspace ID is required"
        );
      }

      // Validate channel name
      if (!name || typeof name !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Channel name is required"
        );
      }

      // Check availability
      const isAvailable = await this.channelService.isChannelNameAvailable(
        workspaceId,
        name
      );

      res.status(200).json({
        success: true,
        data: {
          name,
          isAvailable,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("checkChannelNameAvailability", error, res);
    }
  }

  /**
   * Delete a channel from a workspace
   * DELETE /api/ws-ch/workspaces/:workspaceId/channels/:channelId
   * Only channel owner or workspace owner can delete a channel
   * The "general" channel cannot be deleted
   */
  async deleteChannel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workspaceId, channelId } = req.params;
      const userId = req.user.userId;

      logger.info(
        `Delete channel request: workspaceId=${workspaceId}, channelId=${channelId}, userId=${userId}`
      );

      // Validate workspace ID
      if (!workspaceId || typeof workspaceId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid workspace ID is required"
        );
      }

      // Validate channel ID
      if (!channelId || typeof channelId !== "string") {
        throw WorkspaceChannelServiceError.badRequest(
          "Valid channel ID is required"
        );
      }

      // Validate user ID
      if (!userId) {
        throw WorkspaceChannelServiceError.unauthorized("User ID is required");
      }

      // Delete the channel
      await this.channelService.deleteChannel(workspaceId, channelId, userId);

      res.status(200).json({
        success: true,
        data: {
          channelId,
          workspaceId,
          deleted: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleControllerError("deleteChannel", error, res);
    }
  }

  /**
   * Centralized error handler for controller methods
   */
  private handleControllerError(
    method: string,
    error: unknown,
    res: Response
  ): void {
    logger.error(`Error in ChannelController.${method}:`, error);

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
