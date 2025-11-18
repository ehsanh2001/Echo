import { Router } from "express";
import { ChannelController } from "../controllers/ChannelController";
import { jwtAuth } from "../middleware/auth";
import messageRoutes from "./messageRoutes";

/**
 * Channel routes
 * Base path: /api/workspaces/:workspaceId/channels
 *
 * These routes forward channel management requests to the workspace-channel service,
 * providing a unified API gateway for the frontend.
 */
const channelRoutes = Router({ mergeParams: true }); // mergeParams to access workspaceId from parent

/**
 * GET /api/workspaces/:workspaceId/channels/check-name/:name
 * Check if a channel name is available in a workspace
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "name": "channel-name",
 *     "isAvailable": true
 *   },
 *   "timestamp": "2025-11-18T..."
 * }
 *
 * Note: This endpoint must be defined before the "/:channelId" route
 * to avoid route conflicts (otherwise "check-name" would be treated as a channelId).
 */
channelRoutes.get(
  "/check-name/:name",
  jwtAuth,
  ChannelController.checkChannelName
);

/**
 * POST /api/workspaces/:workspaceId/channels
 * Create a new channel in a workspace
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Body:
 * {
 *   "type": "public" | "private" | "direct" | "group_dm",
 *   "name": "channel-name", // Required for public/private, optional for direct/group_dm
 *   "displayName": "Channel Name", // Optional
 *   "description": "Channel description", // Optional
 *   "participants": ["user-id-1", "user-id-2"] // Required for direct (1 user), group_dm (2+ users)
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "channel-id",
 *     "workspaceId": "workspace-id",
 *     "name": "channel-name",
 *     "displayName": "Channel Name",
 *     "description": "Channel description",
 *     "type": "public",
 *     "createdBy": "user-id",
 *     "memberCount": 1,
 *     "isArchived": false,
 *     "isReadOnly": false,
 *     "createdAt": "2025-10-27T...",
 *     "updatedAt": "2025-10-27T...",
 *     "members": [
 *       { "userId": "user-id", "role": "owner" }
 *     ]
 *   },
 *   "message": "Channel created successfully",
 *   "timestamp": "2025-10-27T..."
 * }
 *
 * Channel Types:
 * - public: Open channel visible to all workspace members
 * - private: Invite-only channel
 * - direct: One-on-one direct message (requires 1 participant)
 * - group_dm: Group direct message (requires 2+ participants)
 */
channelRoutes.post("/", jwtAuth, ChannelController.createChannel);

// Mount message routes under /:channelId/messages
// This creates nested routes like /api/workspaces/:workspaceId/channels/:channelId/messages
channelRoutes.use("/:channelId/messages", messageRoutes);

export default channelRoutes;
