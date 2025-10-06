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

export default workspaceRoutes;
