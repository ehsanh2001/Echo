import { Router } from "express";
import { WorkspaceController } from "../controllers/WorkspaceController";
import { jwtAuth } from "../middleware/jwtAuth";

/**
 * Workspace routes
 * Base path: /api/ws-ch/workspaces
 */
const workspaceRoutes = Router();
// Instantiate controller directly - controllers don't need DI since they have single implementations
const workspaceController = new WorkspaceController();

/**
 * Create a new workspace
 * POST /api/ws-ch/workspaces
 *
 * Body:
 * {
 *   "name": "my-workspace",
 *   "displayName": "My Workspace", // optional
 *   "description": "Description of my workspace" // optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { workspace object },
 *   "message": "Workspace created successfully",
 *   "timestamp": "2025-10-03T..."
 * }
 */
workspaceRoutes.post("/", jwtAuth, async (req, res) => {
  await workspaceController.createWorkspace(req as any, res);
});

/**
 * Check if workspace name is available
 * GET /api/ws-ch/workspaces/check-name/:name
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "name": "my-workspace",
 *     "isAvailable": true
 *   },
 *   "timestamp": "2025-10-03T..."
 * }
 */
workspaceRoutes.get("/check-name/:name", jwtAuth, async (req, res) => {
  await workspaceController.checkNameAvailability(req, res);
});

/**
 * Accept workspace invite
 * POST /api/ws-ch/workspaces/invites/accept
 *
 * Body:
 * {
 *   "token": "uuid-token-string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "workspace": { workspace details },
 *     "channels": [ { channel details } ]
 *   },
 *   "message": "Workspace invite accepted successfully",
 *   "timestamp": "2025-10-03T..."
 * }
 */
workspaceRoutes.post("/invites/accept", jwtAuth, async (req, res) => {
  await workspaceController.acceptInvite(req as any, res);
});

/**
 * Create a workspace invite
 * POST /api/ws-ch/workspaces/:workspaceId/invites
 *
 * Authorization: Only workspace owners and admins can create invites
 *
 * Body:
 * {
 *   "email": "user@example.com", // required
 *   "role": "member", // optional, defaults to "member" (can be "owner", "admin", "member", "guest")
 *   "expiresInDays": 7, // optional, defaults to 7 (1-30 days)
 *   "customMessage": "Welcome to our workspace!" // optional, max 500 characters
 * }
 *
 * Response:
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
 *     "createdAt": "2025-10-16T..."
 *   },
 *   "message": "Workspace invite created successfully",
 *   "timestamp": "2025-10-16T..."
 * }
 */
workspaceRoutes.post("/:workspaceId/invites", jwtAuth, async (req, res) => {
  await workspaceController.createWorkspaceInvite(req as any, res);
});

/**
 * Get workspace members and channel members
 * GET /api/ws-ch/workspaces/:workspaceId/members
 *
 * Returns all workspace members and channel members for channels the user belongs to
 * Private channel members are hidden from non-members
 * User data is enriched from user-service with caching
 * Protected - requires JWT authentication and workspace membership
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "workspaceId": "uuid",
 *     "workspaceName": "my-workspace",
 *     "workspaceMembers": [
 *       {
 *         "userId": "uuid",
 *         "role": "owner",
 *         "joinedAt": "2025-10-03T...",
 *         "user": {
 *           "id": "uuid",
 *           "username": "john_doe",
 *           "displayName": "John Doe",
 *           "email": "john@example.com",
 *           "avatarUrl": "https://...",
 *           "lastSeen": "2025-10-03T..."
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
 *   "timestamp": "2025-10-03T..."
 * }
 */
workspaceRoutes.get("/:workspaceId/members", jwtAuth, async (req, res) => {
  await workspaceController.getWorkspaceMembers(req as any, res);
});

/**
 * Get workspace details
 * GET /api/ws-ch/workspaces/:workspaceId
 *
 * Returns workspace details with user's role and member count
 * Protected - requires JWT authentication
 *
 * Response:
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
 *     "createdAt": "2025-10-03T...",
 *     "updatedAt": "2025-10-03T...",
 *     "userRole": "owner",
 *     "memberCount": 5
 *   },
 *   "timestamp": "2025-10-03T..."
 * }
 */
workspaceRoutes.get("/:workspaceId", jwtAuth, async (req, res) => {
  await workspaceController.getWorkspaceDetails(req as any, res);
});

export default workspaceRoutes;
