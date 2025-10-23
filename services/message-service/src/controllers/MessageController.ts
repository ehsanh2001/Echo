import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { validate as isUUID } from "uuid";
import { IMessageService } from "../interfaces/services/IMessageService";
import { AuthenticatedRequest } from "../middleware/jwtAuth";
import { MessageServiceError } from "../utils/errors";

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
      const { content } = req.body;

      // Validate request (throws if invalid)
      this.validateSendMessageRequest(workspaceId, channelId, content);

      // Call service layer
      const messageWithAuthor = await this.messageService.sendMessage(
        workspaceId as string,
        channelId as string,
        userId,
        content as string
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
