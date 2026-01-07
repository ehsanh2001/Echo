import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "tsyringe";
import { IReadReceiptService } from "../interfaces/services/IReadReceiptService";
import { IWorkspaceChannelServiceClient } from "../interfaces/external/IWorkspaceChannelServiceClient";
import { MessageServiceError } from "../utils/errors";
import logger from "../utils/logger";

/**
 * Extended request type with authenticated user
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roles: string[];
  };
}

/**
 * Controller for read receipt operations
 *
 * Handles HTTP endpoints for:
 * - Marking messages as read
 * - Getting unread counts
 */
@injectable()
export class ReadReceiptController {
  constructor(
    @inject("IReadReceiptService")
    private readReceiptService: IReadReceiptService,
    @inject("IWorkspaceChannelServiceClient")
    private workspaceChannelServiceClient: IWorkspaceChannelServiceClient
  ) {}

  /**
   * Mark messages as read in a channel
   *
   * POST /workspaces/:workspaceId/channels/:channelId/read-receipt
   * Body: { messageNo: number, messageId?: string }
   */
  markAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const channelId = req.params.channelId as string;
      const { messageNo, messageId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw MessageServiceError.unauthorized("User not authenticated");
      }

      // Validate required fields
      if (messageNo === undefined || messageNo === null) {
        throw MessageServiceError.validation("messageNo is required", {
          field: "messageNo",
        });
      }

      const parsedMessageNo = Number(messageNo);
      if (isNaN(parsedMessageNo) || parsedMessageNo < 0) {
        throw MessageServiceError.validation(
          "messageNo must be a non-negative number",
          {
            field: "messageNo",
            value: messageNo,
          }
        );
      }

      // Verify user is a member of the channel
      await this.verifyChannelMembership(workspaceId, channelId, userId);

      // Mark as read
      const receipt = await this.readReceiptService.markAsRead(
        workspaceId,
        channelId,
        userId,
        parsedMessageNo,
        messageId
      );

      res.status(200).json({
        success: true,
        data: receipt,
        message: "Messages marked as read",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's read receipt for a channel
   *
   * GET /workspaces/:workspaceId/channels/:channelId/read-receipt
   */
  getReadReceipt = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const channelId = req.params.channelId as string;
      const userId = req.user?.userId;

      if (!userId) {
        throw MessageServiceError.unauthorized("User not authenticated");
      }

      // Verify user is a member of the channel
      await this.verifyChannelMembership(workspaceId, channelId, userId);

      const receipt = await this.readReceiptService.getReadReceipt(
        workspaceId,
        channelId,
        userId
      );

      res.status(200).json({
        success: true,
        data: receipt,
        message: receipt
          ? "Read receipt retrieved"
          : "No read receipt found for this channel",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get unread count for a specific channel
   *
   * GET /workspaces/:workspaceId/channels/:channelId/unread-count
   */
  getChannelUnreadCount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const channelId = req.params.channelId as string;
      const userId = req.user?.userId;

      if (!userId) {
        throw MessageServiceError.unauthorized("User not authenticated");
      }

      // Verify user is a member of the channel
      await this.verifyChannelMembership(workspaceId, channelId, userId);

      const unreadInfo = await this.readReceiptService.getUnreadCount(
        workspaceId,
        channelId,
        userId
      );

      res.status(200).json({
        success: true,
        data: unreadInfo,
        message: "Unread count retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get unread counts for all channels in a workspace
   *
   * GET /workspaces/:workspaceId/unread-counts
   * Query: channelIds (comma-separated list of channel IDs user is member of)
   */
  getWorkspaceUnreadCounts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const userId = req.user?.userId;

      if (!userId) {
        throw MessageServiceError.unauthorized("User not authenticated");
      }

      // Parse channel IDs from query parameter
      const channelIdsParam = req.query.channelIds as string;
      if (!channelIdsParam) {
        throw MessageServiceError.validation(
          "channelIds query parameter is required",
          {
            field: "channelIds",
          }
        );
      }

      const channelIds = channelIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (channelIds.length === 0) {
        throw MessageServiceError.validation(
          "At least one channelId is required",
          {
            field: "channelIds",
          }
        );
      }

      // Get unread counts
      const unreadCounts =
        await this.readReceiptService.getUnreadCountsForWorkspace(
          workspaceId,
          userId,
          channelIds
        );

      res.status(200).json({
        success: true,
        data: unreadCounts,
        message: "Unread counts retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify user is a member of the channel
   */
  private async verifyChannelMembership(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      const member = await this.workspaceChannelServiceClient.getChannelMember(
        workspaceId,
        channelId,
        userId
      );

      if (!member) {
        throw MessageServiceError.notChannelMember(channelId, userId);
      }
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      logger.error("Failed to verify channel membership", {
        workspaceId,
        channelId,
        userId,
        error,
      });

      throw MessageServiceError.externalService(
        "workspace-channel-service",
        "Failed to verify channel membership",
        { workspaceId, channelId, userId }
      );
    }
  }
}
