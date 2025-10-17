import { Router } from "express";
import { WorkspaceController } from "../controllers/WorkspaceController";
import { jwtAuth } from "../middleware/jwtAuth";

/**
 * Workspace routes
 */
const workspaceRoutes = Router();
// Instantiate controller directly - controllers don't need DI since they have single implementations
const workspaceController = new WorkspaceController();

/**
 * Create a new workspace
 * POST /api/workspaces
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
 * GET /api/workspaces/check-name/:name
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
 * POST /api/workspaces/invites/accept
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
 * Get workspace details
 * GET /api/workspaces/:workspaceId
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
