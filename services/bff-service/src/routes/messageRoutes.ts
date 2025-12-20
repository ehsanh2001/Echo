import { Router } from "express";
import { MessageController } from "../controllers/MessageController";
import { jwtAuth } from "../middleware/auth";

/**
 * Message routes
 * Base path: /api/workspaces/:workspaceId/channels/:channelId/messages
 *
 * These routes forward messaging requests to the message service,
 * providing a unified API gateway for the frontend.
 */
const messageRoutes = Router({ mergeParams: true }); // mergeParams to access workspaceId and channelId from parent

/**
 * POST /api/workspaces/:workspaceId/channels/:channelId/messages
 * Send a message to a channel
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Body:
 * {
 *   "content": "Hello, world!" // Required, max length varies by config
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "message-id",
 *     "workspaceId": "workspace-id",
 *     "channelId": "channel-id",
 *     "userId": "user-id",
 *     "content": "Hello, world!",
 *     "contentType": "text",
 *     "messageNumber": 42,
 *     "isEdited": false,
 *     "isDeleted": false,
 *     "createdAt": "2025-10-27T...",
 *     "updatedAt": "2025-10-27T...",
 *     "author": {
 *       "id": "user-id",
 *       "username": "john_doe",
 *       "displayName": "John Doe",
 *       "avatarUrl": "https://..."
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400: Bad request (empty content, content too long)
 * - 401: Unauthorized (invalid/missing token)
 * - 403: Forbidden (user not member of channel)
 * - 500: Internal server error
 */
messageRoutes.post("/", jwtAuth, MessageController.sendMessage);

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/messages
 * Get message history for a channel with cursor-based pagination
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Query Parameters:
 *   - cursor (optional): Message number to paginate from (non-negative integer)
 *   - limit (optional): Number of messages to return (default: 50, min: 1, max: 100)
 *   - direction (optional): Pagination direction "before" or "after" (required if cursor is provided)
 *
 * Examples:
 *   - GET /messages - Get 50 most recent messages
 *   - GET /messages?limit=20 - Get 20 most recent messages
 *   - GET /messages?cursor=100&direction=before&limit=25 - Get 25 messages before message #100
 *   - GET /messages?cursor=50&direction=after&limit=25 - Get 25 messages after message #50
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "messages": [
 *       {
 *         "id": "message-id",
 *         "workspaceId": "workspace-id",
 *         "channelId": "channel-id",
 *         "userId": "user-id",
 *         "content": "Hello!",
 *         "contentType": "text",
 *         "messageNumber": 42,
 *         "isEdited": false,
 *         "isDeleted": false,
 *         "createdAt": "2025-10-27T...",
 *         "updatedAt": "2025-10-27T...",
 *         "author": {
 *           "id": "user-id",
 *           "username": "john_doe",
 *           "displayName": "John Doe",
 *           "avatarUrl": "https://..."
 *         }
 *       }
 *     ],
 *     "nextCursor": 17,  // null if no more messages in that direction
 *     "prevCursor": 67   // null if no more messages in that direction
 *   }
 * }
 *
 * Error Responses:
 * - 400: Bad request (invalid cursor, limit, or direction)
 * - 401: Unauthorized (invalid/missing token)
 * - 403: Forbidden (user not member of channel)
 * - 500: Internal server error
 */
messageRoutes.get("/", jwtAuth, MessageController.getMessageHistory);

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId
 * Get a single message by ID
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Path Parameters:
 *   - messageId: UUID of the message to retrieve
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "message-id",
 *     "workspaceId": "workspace-id",
 *     "channelId": "channel-id",
 *     "userId": "user-id",
 *     "content": "Hello!",
 *     "contentType": "text",
 *     "messageNumber": 42,
 *     "isEdited": false,
 *     "parentMessageId": "parent-message-id",
 *     "createdAt": "2025-10-27T...",
 *     "updatedAt": "2025-10-27T...",
 *     "author": {
 *       "id": "user-id",
 *       "username": "john_doe",
 *       "displayName": "John Doe",
 *       "avatarUrl": "https://..."
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400: Bad request (invalid message ID format)
 * - 401: Unauthorized (invalid/missing token)
 * - 403: Forbidden (user not member of channel)
 * - 404: Not found (message does not exist)
 * - 500: Internal server error
 */
messageRoutes.get("/:messageId", jwtAuth, MessageController.getMessageById);

export default messageRoutes;
