import { Response } from "express";
import axios from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import { httpClient } from "../utils/httpClient";

/**
 * Channel Controller for BFF Service
 *
 * Forwards channel management requests to the workspace-channel service.
 * Acts as a proxy/gateway for channel operations.
 */
export class ChannelController {
  private static readonly WS_CH_SERVICE_URL =
    config.externalServices.workspaceChannelService;

  /**
   * POST /api/workspaces/:workspaceId/channels
   * Forward channel creation to workspace-channel service
   */
  static createChannel = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.post(
        `${ChannelController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${workspaceId}/channels`,
        req.body,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      ChannelController.handleError(error, res, "Create channel");
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/channels/check-name/:name
   * Forward check if a channel name is available in a workspace
   *
   */
  static checkChannelName = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, name } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.get(
        `${ChannelController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${workspaceId}/channels/check-name/${name}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      ChannelController.handleError(error, res, "Check channel name");
    }
  };

  /**
   * DELETE /api/workspaces/:workspaceId/channels/:channelId
   * Forward delete channel to workspace-channel service
   *
   * Only channel owner or workspace owner can delete a channel.
   * The "general" channel cannot be deleted.
   */
  static deleteChannel = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, channelId } = req.params;
      const authHeader = req.headers.authorization;

      logger.info(
        "Forwarding delete channel request to workspace-channel service",
        {
          workspaceId,
          channelId,
          userId: req.user?.userId,
        }
      );

      const response = await httpClient.delete(
        `${ChannelController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${workspaceId}/channels/${channelId}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      ChannelController.handleError(error, res, "Delete channel");
    }
  };

  /**
   * Handle errors from workspace-channel service
   * Maps axios errors to appropriate HTTP responses
   */
  private static handleError(
    error: any,
    res: Response,
    operation: string
  ): void {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Forward the error response from workspace-channel service (1:1 mapping)
        logger.warn(`${operation} failed`, {
          status: error.response.status,
          data: error.response.data,
        });
        res.status(error.response.status).json(error.response.data);
      } else if (error.request) {
        // Workspace-channel service is unavailable
        logger.error(
          `${operation} failed: Workspace-channel service unavailable`,
          {
            error: error.message,
          }
        );
        res.status(503).json({
          success: false,
          message: "Workspace-channel service is currently unavailable",
          code: "SERVICE_UNAVAILABLE",
        });
      } else {
        // Request setup error
        logger.error(`${operation} failed: Request error`, {
          error: error.message,
        });
        res.status(500).json({
          success: false,
          message: "Failed to process channel request",
          code: "REQUEST_ERROR",
        });
      }
    } else {
      // Non-axios error
      logger.error(`${operation} failed: Unexpected error`, { error });
      res.status(500).json({
        success: false,
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  }
}
