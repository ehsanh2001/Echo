import { Router } from "express";
import { WorkspaceController } from "../controllers/WorkspaceController";
import { ReadReceiptController } from "../controllers/ReadReceiptController";
import { jwtAuth } from "../middleware/auth";
import channelRoutes from "./channelRoutes";

/**
 * Workspace routes
 * Base path: /api/workspaces
 *
 * These routes forward workspace management requests to the workspace-channel service,
 * providing a unified API gateway for the frontend.
 */
const workspaceRoutes = Router();

/**
 * POST /api/workspaces
 * Create a new workspace
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Body:
 * {
 *   "name": "my-workspace",
 *   "displayName": "My Workspace", // optional
 *   "description": "Description of my workspace" // optional
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "my-workspace",
 *     "displayName": "My Workspace",
 *     "description": "Description...",
 *     "ownerId": "uuid",
 *     "isArchived": false,
 *     "isPublic": false,
 *     "createdAt": "2025-10-27T...",
 *     "updatedAt": "2025-10-27T..."
 *   },
 *   "message": "Workspace created successfully",
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.post("/", jwtAuth, WorkspaceController.createWorkspace);

/**
 * GET /api/workspaces/check-name/:name
 * Check if workspace name is available
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "name": "my-workspace",
 *     "isAvailable": true
 *   },
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.get(
  "/check-name/:name",
  jwtAuth,
  WorkspaceController.checkNameAvailability
);

/**
 * POST /api/workspaces/invites/accept
 * Accept a workspace invite
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Body:
 * {
 *   "token": "uuid-token-string"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "workspace": {
 *       "id": "uuid",
 *       "name": "my-workspace",
 *       "displayName": "My Workspace",
 *       ...
 *     },
 *     "channels": [
 *       {
 *         "id": "uuid",
 *         "name": "general",
 *         ...
 *       }
 *     ]
 *   },
 *   "message": "Workspace invite accepted successfully",
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.post(
  "/invites/accept",
  jwtAuth,
  WorkspaceController.acceptInvite
);

/**
 * GET /api/workspaces/me/memberships?includeChannels=true
 * Get current user's workspace and channel memberships
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Query Parameters:
 *   includeChannels: boolean (optional) - Whether to include channels for each workspace
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "workspaces": [
 *       {
 *         "id": "uuid",
 *         "name": "my-workspace",
 *         "displayName": "My Workspace",
 *         "userRole": "admin",
 *         "memberCount": 5,
 *         "channels": [  // Only if includeChannels=true
 *           {
 *             "id": "uuid",
 *             "name": "general",
 *             "displayName": "General",
 *             "type": "public",
 *             "role": "admin",
 *             "joinedAt": "2025-10-27T...",
 *             ...
 *           }
 *         ]
 *       }
 *     ]
 *   },
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.get(
  "/me/memberships",
  jwtAuth,
  WorkspaceController.getUserMemberships
);

/**
 * POST /api/workspaces/:id/invites
 * Create a workspace invite
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Body:
 * {
 *   "email": "user@example.com", // required
 *   "role": "member", // optional, defaults to "member" (can be "owner", "admin", "member", "guest")
 *   "expiresInDays": 7, // optional, defaults to 7 (1-30 days)
 *   "customMessage": "Welcome to our workspace!" // optional, max 500 characters
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "inviteId": "uuid",
 *     "email": "user@example.com",
 *     "workspaceId": "uuid",
 *     "workspaceName": "my-workspace",
 *     "workspaceDisplayName": "My Workspace",
 *     "role": "member",
 *     "invitedBy": "uuid",
 *     "inviteToken": "secure-token",
 *     "inviteUrl": "https://app.example.com/invite/secure-token",
 *     "expiresAt": "2025-10-23T...",
 *     "customMessage": "Welcome to our workspace!",
 *     "createdAt": "2025-10-27T..."
 *   },
 *   "message": "Workspace invite created successfully",
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.post("/:id/invites", jwtAuth, WorkspaceController.createInvite);

/**
 * GET /api/workspaces/:id/members
 * Get workspace members and channel members
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "workspaceId": "uuid",
 *     "workspaceName": "my-workspace",
 *     "workspaceMembers": [
 *       {
 *         "userId": "uuid",
 *         "role": "admin",
 *         "joinedAt": "2025-10-27T...",
 *         "isActive": true,
 *         "user": {
 *           "id": "uuid",
 *           "username": "johndoe",
 *           "displayName": "John Doe",
 *           "email": "john@example.com",
 *           "avatarUrl": "https://...",
 *           "lastSeen": "2025-10-27T..."
 *         }
 *       }
 *     ],
 *     "channels": [
 *       {
 *         "id": "uuid",
 *         "name": "general",
 *         "displayName": "General",
 *         "type": "public",
 *         "members": [...]
 *       }
 *     ]
 *   },
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.get(
  "/:id/members",
  jwtAuth,
  WorkspaceController.getWorkspaceMembers
);

/**
 * DELETE /api/workspaces/:id
 * Delete a workspace (owner only)
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Workspace deleted successfully",
 *   "data": {
 *     "workspaceId": "uuid",
 *     "workspaceName": "my-workspace"
 *   },
 *   "timestamp": "2025-10-27T..."
 * }
 *
 * Error Responses:
 * - 403: Not workspace owner
 * - 404: Workspace not found
 */
workspaceRoutes.delete("/:id", jwtAuth, WorkspaceController.deleteWorkspace);

/**
 * GET /api/workspaces/:id
 * Get workspace details
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "my-workspace",
 *     "displayName": "My Workspace",
 *     "description": "Description...",
 *     "ownerId": "uuid",
 *     "isArchived": false,
 *     "isPublic": false,
 *     "maxMembers": null,
 *     "vanityUrl": null,
 *     "settings": {},
 *     "createdAt": "2025-10-27T...",
 *     "updatedAt": "2025-10-27T...",
 *     "userRole": "owner",
 *     "memberCount": 5
 *   },
 *   "timestamp": "2025-10-27T..."
 * }
 */
workspaceRoutes.get("/:id", jwtAuth, WorkspaceController.getWorkspaceDetails);

/**
 * GET /api/workspaces/:workspaceId/unread-counts
 * Get unread counts for all channels in a workspace
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Query Parameters:
 *   - channelIds: Comma-separated list of channel IDs (required)
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "workspaceId": "workspace-id",
 *     "channels": [
 *       {
 *         "channelId": "channel-1",
 *         "unreadCount": 5,
 *         "lastMessageNo": 155,
 *         "lastReadMessageNo": 150
 *       }
 *     ],
 *     "totalUnread": 15
 *   },
 *   "message": "Unread counts retrieved",
 *   "timestamp": "2025-01-07T..."
 * }
 *
 * Error Responses:
 * - 400: Bad request (missing channelIds)
 * - 401: Unauthorized (invalid/missing token)
 * - 500: Internal server error
 */
workspaceRoutes.get(
  "/:workspaceId/unread-counts",
  jwtAuth,
  ReadReceiptController.getWorkspaceUnreadCounts
);

// Mount channel routes under /:workspaceId/channels
// This creates nested routes like /api/workspaces/:workspaceId/channels
workspaceRoutes.use("/:workspaceId/channels", channelRoutes);

export default workspaceRoutes;
