import { Response } from "express";
import axios from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Message Controller for BFF Service
 *
 * Forwards messaging requests to the message service.
 * Acts as a proxy/gateway for message operations.
 */
export class MessageController {
  private static readonly MESSAGE_SERVICE_URL =
    config.externalServices.messageService;

  /**
   * POST /api/workspaces/:workspaceId/channels/:channelId/messages
   * Forward send message to message service
   */
  static sendMessage = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, channelId } = req.params;
      const authHeader = req.headers.authorization;

      const response = await axios.post(
        `${MessageController.MESSAGE_SERVICE_URL}/api/messages/workspaces/${workspaceId}/channels/${channelId}/messages`,
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
      MessageController.handleError(error, res, "Send message");
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/channels/:channelId/messages
   * Forward get message history to message service
   */
  static getMessageHistory = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, channelId } = req.params;
      const authHeader = req.headers.authorization;

      // Forward query parameters (cursor, limit, direction)
      const response = await axios.get(
        `${MessageController.MESSAGE_SERVICE_URL}/api/messages/workspaces/${workspaceId}/channels/${channelId}/messages`,
        {
          headers: {
            Authorization: authHeader,
          },
          params: req.query, // Forward cursor, limit, direction query params
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      MessageController.handleError(error, res, "Get message history");
    }
  };

  /**
   * Handle errors from message service
   * Maps axios errors to appropriate HTTP responses
   */
  private static handleError(
    error: any,
    res: Response,
    operation: string
  ): void {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Forward the error response from message service (1:1 mapping)
        logger.warn(`${operation} failed`, {
          status: error.response.status,
          data: error.response.data,
        });
        res.status(error.response.status).json(error.response.data);
      } else if (error.request) {
        // Message service is unavailable
        logger.error(`${operation} failed: Message service unavailable`, {
          error: error.message,
        });
        res.status(503).json({
          success: false,
          message: "Message service is currently unavailable",
          code: "SERVICE_UNAVAILABLE",
        });
      } else {
        // Request setup error
        logger.error(`${operation} failed: Request error`, {
          error: error.message,
        });
        res.status(500).json({
          success: false,
          message: "Failed to process message request",
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
