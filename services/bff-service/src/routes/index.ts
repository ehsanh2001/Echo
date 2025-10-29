import { Router } from "express";
import authRoutes from "./authRoutes";
import workspaceRoutes from "./workspaceRoutes";
import messageRoutes from "./messageRoutes";
/**
 * Main BFF routes
 * Base path: /api
 */
const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount workspace routes
router.use("/workspaces", workspaceRoutes);

// Mount message routes
router.use("/messages", messageRoutes);

export default router;
