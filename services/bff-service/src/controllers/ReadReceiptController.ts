import { Response } from "express";
import axios from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import { httpClient } from "../utils/httpClient";
import { getSocketIO, isSocketIOInitialized } from "../utils/socketIO";

/**
 * Read Receipt Controller for BFF Service
 *
 * Forwards read receipt requests to the message service.
 * Acts as a proxy/gateway for read receipt operations.
 */
export class ReadReceiptController {
  private static readonly MESSAGE_SERVICE_URL =
    config.externalServices.messageService;

  /**
   * POST /api/workspaces/:workspaceId/channels/:channelId/read-receipt
   * Forward mark as read to message service
   */
  static markAsRead = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, channelId } = req.params;
      const authHeader = req.headers.authorization;
      const userId = req.user?.userId;

      const response = await httpClient.post(
        `${ReadReceiptController.MESSAGE_SERVICE_URL}/api/messages/workspaces/${workspaceId}/channels/${channelId}/read-receipt`,
        req.body,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      // Emit socket event to notify the user's other clients
      if (response.status === 200 && response.data?.success && userId) {
        ReadReceiptController.emitReadReceiptUpdated(
          response.data.data,
          userId
        );
      }

      res.status(response.status).json(response.data);
    } catch (error) {
      ReadReceiptController.handleError(error, res, "Mark as read");
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/channels/:channelId/read-receipt
   * Forward get read receipt to message service
   */
  static getReadReceipt = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, channelId } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.get(
        `${ReadReceiptController.MESSAGE_SERVICE_URL}/api/messages/workspaces/${workspaceId}/channels/${channelId}/read-receipt`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      ReadReceiptController.handleError(error, res, "Get read receipt");
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/channels/:channelId/unread-count
   * Forward get unread count to message service
   */
  static getChannelUnreadCount = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId, channelId } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.get(
        `${ReadReceiptController.MESSAGE_SERVICE_URL}/api/messages/workspaces/${workspaceId}/channels/${channelId}/unread-count`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      ReadReceiptController.handleError(error, res, "Get unread count");
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/unread-counts
   * Forward get workspace unread counts to message service
   */
  static getWorkspaceUnreadCounts = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.get(
        `${ReadReceiptController.MESSAGE_SERVICE_URL}/api/messages/workspaces/${workspaceId}/unread-counts`,
        {
          headers: {
            Authorization: authHeader,
          },
          params: req.query, // Forward channelIds query param
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      ReadReceiptController.handleError(
        error,
        res,
        "Get workspace unread counts"
      );
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
          message: "Failed to process read receipt request",
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

  /**
   * Emit read-receipt:updated socket event to user's room
   * This allows other browser tabs/devices to sync their unread state
   */
  private static emitReadReceiptUpdated(
    receiptData: {
      workspaceId: string;
      channelId: string;
      userId: string;
      lastReadMessageNo: number;
      lastReadMessageId: string | null;
      lastReadAt: string;
    },
    userId: string
  ): void {
    try {
      if (!isSocketIOInitialized()) {
        logger.warn("Socket.IO not initialized, skipping read receipt emit");
        return;
      }

      const io = getSocketIO();
      const userRoom = `user:${userId}`;

      io.to(userRoom).emit("read-receipt:updated", {
        workspaceId: receiptData.workspaceId,
        channelId: receiptData.channelId,
        userId: receiptData.userId,
        lastReadMessageNo: receiptData.lastReadMessageNo,
        lastReadMessageId: receiptData.lastReadMessageId,
        lastReadAt: receiptData.lastReadAt,
      });

      logger.debug("Emitted read-receipt:updated", {
        userId,
        channelId: receiptData.channelId,
        lastReadMessageNo: receiptData.lastReadMessageNo,
      });
    } catch (error) {
      // Don't fail the API request if socket emit fails
      logger.error("Failed to emit read-receipt:updated", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
