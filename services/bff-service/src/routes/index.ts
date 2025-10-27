import { Router } from "express";
import authRoutes from "./authRoutes";
import workspaceRoutes from "./workspaceRoutes";

/**
 * Main BFF routes
 * Base path: /api
 */
const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount workspace routes
router.use("/workspaces", workspaceRoutes);

// TODO: Add more route modules:
// router.use("/channels", channelRoutes);
// router.use("/messages", messageRoutes);
// router.use("/users", userRoutes);

export default router;
