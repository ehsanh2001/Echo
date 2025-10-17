import { Router } from "express";
import { InviteController } from "../controllers/InviteController";
import { jwtAuth } from "../middleware/jwtAuth";

/**
 * Workspace invitation routes
 * Base path: /api/workspaces/:workspaceId/invites
 */
const inviteRoutes = Router({ mergeParams: true }); // mergeParams to access :workspaceId from parent router

// Instantiate controller directly - controllers don't need DI since they have single implementations
const inviteController = new InviteController();

/**
 * Create a workspace invite
 * POST /api/workspaces/:workspaceId/invites
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
 *     "id": "uuid",
 *     "workspaceId": "uuid",
 *     "inviterId": "uuid",
 *     "inviterEmail": "inviter@example.com",
 *     "inviteeEmail": "user@example.com",
 *     "role": "member",
 *     "token": "secure-token-here",
 *     "inviteUrl": "https://app.example.com/invite/secure-token-here",
 *     "status": "pending",
 *     "expiresAt": "2025-10-23T...",
 *     "customMessage": "Welcome to our workspace!",
 *     "createdAt": "2025-10-16T...",
 *     "updatedAt": "2025-10-16T..."
 *   },
 *   "message": "Workspace invite created successfully",
 *   "timestamp": "2025-10-16T..."
 * }
 */
inviteRoutes.post("/", jwtAuth, async (req, res) => {
  await inviteController.createWorkspaceInvite(req as any, res);
});

export default inviteRoutes;
