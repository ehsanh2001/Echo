import { Router } from "express";
import { ChannelController } from "../controllers/ChannelController";
import { jwtAuth } from "../middleware/auth";

/**
 * Channel routes
 * Base path: /api/workspaces/:workspaceId/channels
 *
 * These routes forward channel management requests to the workspace-channel service,
 * providing a unified API gateway for the frontend.
 */
const channelRoutes = Router({ mergeParams: true }); // mergeParams to access workspaceId from parent

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

export default channelRoutes;
