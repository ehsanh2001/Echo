import { Router } from "express";
import { ReadReceiptController } from "../controllers/ReadReceiptController";
import { jwtAuth } from "../middleware/auth";

/**
 * Read Receipt Routes
 * Base path: /api/workspaces/:workspaceId/channels/:channelId
 *
 * These routes forward read receipt requests to the message service,
 * enabling unread message tracking functionality.
 */
const readReceiptRoutes = Router({ mergeParams: true }); // mergeParams to access workspaceId and channelId from parent

/**
 * POST /api/workspaces/:workspaceId/channels/:channelId/read-receipt
 * Mark messages as read in a channel
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Body:
 * {
 *   "messageNo": 150,           // Required: Message number to mark as last read
 *   "messageId": "uuid"         // Optional: Message UUID for reference
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "workspaceId": "workspace-id",
 *     "channelId": "channel-id",
 *     "userId": "user-id",
 *     "lastReadMessageNo": 150,
 *     "lastReadMessageId": "uuid",
 *     "lastReadAt": "2025-01-07T..."
 *   },
 *   "message": "Messages marked as read",
 *   "timestamp": "2025-01-07T..."
 * }
 *
 * Error Responses:
 * - 400: Bad request (invalid messageNo)
 * - 401: Unauthorized (invalid/missing token)
 * - 403: Forbidden (user not member of channel)
 * - 500: Internal server error
 */
readReceiptRoutes.post(
  "/read-receipt",
  jwtAuth,
  ReadReceiptController.markAsRead
);

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/read-receipt
 * Get user's read receipt for a channel
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "workspaceId": "workspace-id",
 *     "channelId": "channel-id",
 *     "userId": "user-id",
 *     "lastReadMessageNo": 150,
 *     "lastReadMessageId": "uuid",
 *     "lastReadAt": "2025-01-07T..."
 *   } | null,
 *   "message": "Read receipt retrieved",
 *   "timestamp": "2025-01-07T..."
 * }
 *
 * Error Responses:
 * - 401: Unauthorized (invalid/missing token)
 * - 403: Forbidden (user not member of channel)
 * - 500: Internal server error
 */
readReceiptRoutes.get(
  "/read-receipt",
  jwtAuth,
  ReadReceiptController.getReadReceipt
);

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/unread-count
 * Get unread message count for a specific channel
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "channelId": "channel-id",
 *     "unreadCount": 5,
 *     "lastMessageNo": 155,
 *     "lastReadMessageNo": 150
 *   },
 *   "message": "Unread count retrieved",
 *   "timestamp": "2025-01-07T..."
 * }
 *
 * Error Responses:
 * - 401: Unauthorized (invalid/missing token)
 * - 403: Forbidden (user not member of channel)
 * - 500: Internal server error
 */
readReceiptRoutes.get(
  "/unread-count",
  jwtAuth,
  ReadReceiptController.getChannelUnreadCount
);

export default readReceiptRoutes;
