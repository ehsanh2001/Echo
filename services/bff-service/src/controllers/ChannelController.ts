import { Response } from "express";
import axios from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";

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

      const response = await axios.post(
        `${ChannelController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${workspaceId}/channels`,
        req.body,
        {
          headers: {
            "Content-Type": "application/json",
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
