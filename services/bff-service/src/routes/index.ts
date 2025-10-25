import { Router } from "express";
import authRoutes from "./authRoutes";

/**
 * Main BFF routes
 * Base path: /api
 */
const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);

// TODO: Add more route modules:
// router.use("/workspaces", workspaceRoutes);
// router.use("/channels", channelRoutes);
// router.use("/messages", messageRoutes);
// router.use("/users", userRoutes);

export default router;
