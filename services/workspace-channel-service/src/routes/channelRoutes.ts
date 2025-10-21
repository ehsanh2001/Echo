import { Router } from "express";
import { ChannelController } from "../controllers/ChannelController";
import { jwtAuth } from "../middleware/jwtAuth";

/**
 * Channel routes
 * Base path: /api/ws-ch/workspaces/:workspaceId/channels
 */
const channelRoutes = Router({ mergeParams: true }); // mergeParams to access workspaceId from parent router
const channelController = new ChannelController();

/**
 * Create a new channel in a workspace
 * POST /api/ws-ch/workspaces/:workspaceId/channels
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
 * Response:
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
 *     "createdAt": "2025-10-17T...",
 *     "updatedAt": "2025-10-17T...",
 *     "members": [
 *       { "userId": "user-id", "role": "owner" }
 *     ]
 *   },
 *   "message": "Channel created successfully",
 *   "timestamp": "2025-10-17T..."
 * }
 */
channelRoutes.post("/", jwtAuth, async (req, res) => {
  await channelController.createChannel(req as any, res);
});

/**
 * Get a channel member
 * GET /api/ws-ch/workspaces/:workspaceId/channels/:channelId/members/:userId
 *
 * Response (200 - Member found):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "channel-member-id",
 *     "channelId": "channel-id",
 *     "userId": "user-id",
 *     "joinedBy": "inviter-user-id",
 *     "joinedAt": "2025-10-17T...",
 *     "role": "member",
 *     "isMuted": false,
 *     "isActive": true
 *   },
 *   "message": "Channel member retrieved successfully",
 *   "timestamp": "2025-10-17T..."
 * }
 *
 * Response (404 - Member not found):
 * {
 *   "success": false,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Channel member not found"
 *   },
 *   "timestamp": "2025-10-17T..."
 * }
 */
channelRoutes.get("/:channelId/members/:userId", async (req, res) => {
  await channelController.getChannelMember(req, res);
});

export default channelRoutes;
