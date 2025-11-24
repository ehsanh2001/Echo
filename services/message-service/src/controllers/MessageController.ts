import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { validate as isUUID } from "uuid";
import { IMessageService } from "../interfaces/services/IMessageService";
import { AuthenticatedRequest } from "../middleware/jwtAuth";
import { MessageServiceError } from "../utils/errors";
import { PaginationDirection } from "../types";
import { config } from "../config/env";
/**
 * Message Controller
 * Handles HTTP requests for message operations
 */
@injectable()
export class MessageController {
  constructor(
    @inject("IMessageService") private messageService: IMessageService
  ) {}

  /**
   * Send a message to a channel
   * POST /api/messages/workspaces/:workspaceId/channels/:channelId/messages
   */
  sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract authenticated user
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.userId;

      // Extract path parameters
      const { workspaceId, channelId } = req.params;

      // Extract body
      const { content, clientMessageCorrelationId } = req.body;

      // Validate request (throws if invalid)
      this.validateSendMessageRequest(workspaceId, channelId, content);

      // Call service layer
      const messageWithAuthor = await this.messageService.sendMessage(
        workspaceId as string,
        channelId as string,
        userId,
        content as string,
        clientMessageCorrelationId as string
      );

      // Return success response
      res.status(201).json({
        success: true,
        data: messageWithAuthor,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Get message history for a channel with pagination
   * GET /api/messages/workspaces/:workspaceId/channels/:channelId/messages
   */
  getMessageHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract authenticated user
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.userId;

      // Extract path parameters
      const { workspaceId, channelId } = req.params;

      // Validate path parameters
      this.validateGetMessageHistoryRequest(workspaceId, channelId);

      // Parse and validate query parameters
      const queryParams = this.parseMessageHistoryQueryParams(req.query);

      // Call service layer
      const messageHistory = await this.messageService.getMessageHistory(
        workspaceId as string,
        channelId as string,
        userId,
        queryParams
      );

      // Return success response
      res.status(200).json({
        success: true,
        data: messageHistory,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Parse and validate message history query parameters
   */
  private parseMessageHistoryQueryParams(query: any): {
    cursor?: number;
    limit?: number;
    direction?: PaginationDirection;
  } {
    const { cursor, limit, direction } = query;
    const queryParams: {
      cursor?: number;
      limit?: number;
      direction?: PaginationDirection;
    } = {};

    // Parse cursor
    if (cursor !== undefined) {
      const parsedCursor = parseInt(cursor as string);
      if (isNaN(parsedCursor) || parsedCursor < 0) {
        throw MessageServiceError.validation(
          "Cursor must be a non-negative integer",
          { field: "cursor", value: cursor }
        );
      }
      queryParams.cursor = parsedCursor;
    }

    // Parse and validate limit
    if (limit !== undefined) {
      const parsedLimit = parseInt(limit as string);
      if (isNaN(parsedLimit)) {
        throw MessageServiceError.validation(
          "Limit must be a positive integer",
          { field: "limit", value: limit }
        );
      }
      if (parsedLimit < config.pagination.minLimit) {
        throw MessageServiceError.validation(
          `Limit must be at least ${config.pagination.minLimit}`,
          { field: "limit", value: parsedLimit }
        );
      }
      if (parsedLimit > config.pagination.maxLimit) {
        throw MessageServiceError.validation(
          `Limit cannot exceed ${config.pagination.maxLimit}`,
          { field: "limit", value: parsedLimit }
        );
      }
      queryParams.limit = parsedLimit;
    } else {
      queryParams.limit = config.pagination.defaultLimit;
    }

    // Parse and validate direction
    if (direction !== undefined) {
      const lowerDirection = (direction as string).toLowerCase();
      if (
        lowerDirection !== PaginationDirection.BEFORE &&
        lowerDirection !== PaginationDirection.AFTER
      ) {
        throw MessageServiceError.validation(
          `Direction must be either '${PaginationDirection.BEFORE}' or '${PaginationDirection.AFTER}'`,
          { field: "direction", value: direction }
        );
      }
      queryParams.direction = lowerDirection as PaginationDirection;
    }

    // Validation: If cursor is provided, direction is required
    if (
      queryParams.cursor !== undefined &&
      queryParams.direction === undefined
    ) {
      throw MessageServiceError.validation(
        "Direction parameter is required when cursor is provided",
        { field: "direction" }
      );
    }

    // Note: If cursor is NOT provided, we get the newest messages (default behavior in service)
    // Direction without cursor is ignored by the service layer

    return queryParams;
  }

  /**
   * Validate get message history request parameters
   */
  private validateGetMessageHistoryRequest(
    workspaceId: string | undefined,
    channelId: string | undefined
  ): void {
    // Validate workspaceId
    if (!isUUID(workspaceId)) {
      throw MessageServiceError.validation(
        "Workspace ID is required and must be a valid UUID",
        {
          field: "workspaceId",
          value: workspaceId,
        }
      );
    }

    // Validate channelId
    if (!isUUID(channelId)) {
      throw MessageServiceError.validation(
        "Channel ID is required and must be a valid UUID",
        {
          field: "channelId",
          value: channelId,
        }
      );
    }
  }

  /**
   * Validate send message request parameters
   */
  private validateSendMessageRequest(
    workspaceId: string | undefined,
    channelId: string | undefined,
    content: any
  ): void {
    // Validate workspaceId
    if (!isUUID(workspaceId)) {
      throw MessageServiceError.validation(
        "Workspace ID is required and must be a valid UUID",
        {
          field: "workspaceId",
          value: workspaceId,
        }
      );
    }

    // Validate channelId
    if (!isUUID(channelId)) {
      throw MessageServiceError.validation(
        "Channel ID is required and must be a valid UUID",
        {
          field: "channelId",
          value: channelId,
        }
      );
    }

    // Validate content
    if (!content || typeof content !== "string") {
      throw MessageServiceError.validation("Message content is required", {
        field: "content",
      });
    }
  }

  /**
   * Handle errors and send appropriate HTTP responses
   */
  private handleError(error: unknown, res: Response): void {
    console.error("Controller error:", error);

    // Handle MessageServiceError
    if (error instanceof MessageServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    // Handle unknown errors
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }
}
