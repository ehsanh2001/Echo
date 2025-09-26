import { Router } from "express";
import { UserController } from "../controllers/userController";
import { jwtAuth } from "../middleware/jwtAuth";

const router = Router();

// Auth routes
router.post("/auth/register", UserController.register);
router.post("/auth/login", UserController.login);
router.post("/auth/refresh", UserController.refresh);
// Type flow: Request → [jwtAuth] → AuthenticatedRequest → [UserController.logout]
router.post("/auth/logout", jwtAuth, UserController.logout); // Protected with JWT auth

export default router;
