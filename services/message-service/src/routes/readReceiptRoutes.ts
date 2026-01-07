import { Router } from "express";
import { container } from "../container";
import { ReadReceiptController } from "../controllers/ReadReceiptController";
import { jwtAuth } from "../middleware/jwtAuth";

/**
 * Read Receipt Routes
 * Defines HTTP routes for read receipt operations
 */
const router = Router();

// Get controller instance from DI container
const readReceiptController = container.resolve(ReadReceiptController);

/**
 * POST /api/messages/workspaces/:workspaceId/channels/:channelId/read-receipt
 * Mark messages as read in a channel
 *
 * @route POST /workspaces/:workspaceId/channels/:channelId/read-receipt
 * @middleware jwtAuth - Requires valid JWT token
 * @param {string} workspaceId - Workspace ID (path parameter)
 * @param {string} channelId - Channel ID (path parameter)
 * @body {number} messageNo - Message number to mark as last read
 * @body {string} [messageId] - Optional message UUID
 * @returns {200} Read receipt updated successfully
 * @returns {400} Bad request - Invalid input
 * @returns {401} Unauthorized - Invalid or missing JWT token
 * @returns {403} Forbidden - User not a member of channel
 * @returns {500} Internal server error
 */
router.post(
  "/workspaces/:workspaceId/channels/:channelId/read-receipt",
  jwtAuth,
  readReceiptController.markAsRead
);

/**
 * GET /api/messages/workspaces/:workspaceId/channels/:channelId/read-receipt
 * Get user's read receipt for a channel
 *
 * @route GET /workspaces/:workspaceId/channels/:channelId/read-receipt
 * @middleware jwtAuth - Requires valid JWT token
 * @param {string} workspaceId - Workspace ID (path parameter)
 * @param {string} channelId - Channel ID (path parameter)
 * @returns {200} Read receipt retrieved (or null if not found)
 * @returns {401} Unauthorized - Invalid or missing JWT token
 * @returns {403} Forbidden - User not a member of channel
 * @returns {500} Internal server error
 */
router.get(
  "/workspaces/:workspaceId/channels/:channelId/read-receipt",
  jwtAuth,
  readReceiptController.getReadReceipt
);

/**
 * GET /api/messages/workspaces/:workspaceId/channels/:channelId/unread-count
 * Get unread message count for a specific channel
 *
 * @route GET /workspaces/:workspaceId/channels/:channelId/unread-count
 * @middleware jwtAuth - Requires valid JWT token
 * @param {string} workspaceId - Workspace ID (path parameter)
 * @param {string} channelId - Channel ID (path parameter)
 * @returns {200} Unread count with channel info
 * @returns {401} Unauthorized - Invalid or missing JWT token
 * @returns {403} Forbidden - User not a member of channel
 * @returns {500} Internal server error
 */
router.get(
  "/workspaces/:workspaceId/channels/:channelId/unread-count",
  jwtAuth,
  readReceiptController.getChannelUnreadCount
);

/**
 * GET /api/messages/workspaces/:workspaceId/unread-counts
 * Get unread counts for all channels in a workspace
 *
 * @route GET /workspaces/:workspaceId/unread-counts
 * @middleware jwtAuth - Requires valid JWT token
 * @param {string} workspaceId - Workspace ID (path parameter)
 * @query {string} channelIds - Comma-separated list of channel IDs
 * @returns {200} Unread counts for all specified channels
 * @returns {400} Bad request - Missing channelIds
 * @returns {401} Unauthorized - Invalid or missing JWT token
 * @returns {500} Internal server error
 */
router.get(
  "/workspaces/:workspaceId/unread-counts",
  jwtAuth,
  readReceiptController.getWorkspaceUnreadCounts
);

export { router as readReceiptRoutes };
