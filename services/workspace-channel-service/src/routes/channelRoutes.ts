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

export default channelRoutes;
