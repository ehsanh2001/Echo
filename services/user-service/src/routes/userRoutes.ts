import { Router } from "express";
import { UserController } from "../controllers/userController";
import { jwtAuth } from "../middleware/jwtAuth";
import { jwtRefreshAuth } from "../middleware/jwtAuth";
const router = Router();

// Auth routes
router.post("/auth/register", UserController.register);
router.post("/auth/login", UserController.login);
router.post("/auth/refresh", jwtRefreshAuth, UserController.refresh);
// Type flow: Request → [jwtAuth] → AuthenticatedRequest → [UserController.logout]
router.post("/auth/logout", jwtAuth, UserController.logout); // Protected with JWT auth

// Public routes
router.get("/:id", UserController.getPublicProfile); // Public profile lookup
router.get("/searchbyemail/:email", UserController.getPublicProfileByEmail); // Search by email for invitations
router.post("/batch", UserController.getUsersByIds); // Batch fetch users by IDs

export default router;
