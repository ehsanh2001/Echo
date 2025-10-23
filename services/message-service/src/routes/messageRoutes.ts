import { Router } from "express";
import { container } from "../container";
import { MessageController } from "../controllers/MessageController";
import { jwtAuth } from "../middleware/jwtAuth";

/**
 * Message Routes
 * Defines HTTP routes for message operations
 */
const router = Router();

// Get controller instance from DI container
const messageController = container.resolve(MessageController);

/**
 * POST /api/messages/workspaces/:workspaceId/channels/:channelId/messages
 * Send a message to a channel
 *
 * @route POST /workspaces/:workspaceId/channels/:channelId/messages
 * @middleware jwtAuth - Requires valid JWT token
 * @param {string} workspaceId - Workspace ID (path parameter)
 * @param {string} channelId - Channel ID (path parameter)
 * @param {string} content - Message content (body)
 * @returns {201} Message created successfully with author info
 * @returns {400} Bad request - Invalid input
 * @returns {401} Unauthorized - Invalid or missing JWT token
 * @returns {403} Forbidden - User not a member of channel
 * @returns {500} Internal server error
 */
router.post(
  "/workspaces/:workspaceId/channels/:channelId/messages",
  jwtAuth,
  messageController.sendMessage
);

export { router as messageRoutes };
