// OpenTelemetry must be initialized FIRST before any other imports
import "@echo/telemetry";

import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requestContextMiddleware } from "@echo/telemetry";
import { createHttpStream } from "@echo/logger";
import { metricsMiddleware, metricsEndpoint } from "@echo/metrics";
import { PrismaClient } from "@prisma/client";
import { config } from "./config/env";
import logger from "./utils/logger";
import "./container"; // Auto-configure dependency injection
import { container } from "./container";
import { IOutboxPublisher } from "./interfaces/workers/IOutboxPublisher";
import morgan from "morgan";

const prisma = new PrismaClient();
const app = express();

// Metrics endpoint FIRST - before any other middleware (no auth, no rate limit)
app.get("/metrics", metricsEndpoint());

// Initialize metrics collection
app.use(metricsMiddleware({ serviceName: "workspace-channel-service" }));

// Request context middleware - sets up OTel context
app.use(requestContextMiddleware());

// HTTP request logging
app.use(morgan("combined", { stream: createHttpStream(logger) }));

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
  skip: (req) =>
    req.path === "/metrics" ||
    req.path.startsWith("/health") ||
    req.path.endsWith("/health"), // Skip rate limiting for metrics and health checks
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Import routes after dependencies are configured
import workspaceRoutes from "./routes/workspaceRoutes";
import channelRoutes from "./routes/channelRoutes";
import { WorkspaceController } from "./controllers/WorkspaceController";
import { jwtAuth } from "./middleware/jwtAuth";

// Instantiate controllers for direct routes
const workspaceController = new WorkspaceController();

// API routes - new routing structure
// Main path: /api/ws-ch

/**
 * Get user's workspace and channel memberships
 * GET /api/ws-ch/me/memberships?includeChannels=true
 */
app.get("/api/ws-ch/me/memberships", jwtAuth, async (req, res) => {
  await workspaceController.getUserMemberships(req as any, res);
});

app.use("/api/ws-ch/workspaces", workspaceRoutes);
// Mount channel routes under each workspace
// This creates the path: /api/ws-ch/workspaces/:workspaceId/channels
app.use("/api/ws-ch/workspaces/:workspaceId/channels", channelRoutes);

// Health check endpoint
app.get("/health", async (req, res) => {
  const healthInfo = {
    status: "healthy",
    service: config.service.name,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json(healthInfo);
  } catch (error) {
    logger.error("Health check failed:", error);

    const unhealthyInfo = {
      ...healthInfo,
      status: "unhealthy",
    };

    res.status(503).json(unhealthyInfo);
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    service: config.service.name,
  });
});

// Error handling middleware
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", error);

    res.status(500).json({
      error: "Internal Server Error",
      message:
        config.nodeEnv === "development"
          ? error.message
          : "Something went wrong",
      service: config.service.name,
    });
  }
);

async function startServer() {
  try {
    logger.info("🚀 Starting Workspace-Channel Service...");

    // Test database connection
    await prisma.$connect();
    logger.info("✅ Database connection successful");

    // Start Outbox Publisher Worker
    const outboxPublisher =
      container.resolve<IOutboxPublisher>("IOutboxPublisher");
    await outboxPublisher.start();
    logger.info("✅ Outbox Publisher Worker started");

    // Start the server
    const server = app.listen(config.port, () => {
      logger.info(`🌐 Server running on port ${config.port}`);
      logger.info(`🔧 Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n📤 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("🔌 HTTP server closed");

        try {
          // Stop Outbox Publisher Worker
          await outboxPublisher.stop();
          logger.info("🛑 Outbox Publisher Worker stopped");

          await prisma.$disconnect();
          logger.info("💾 Database connection closed");
          logger.info("👋 Graceful shutdown complete");
          process.exit(0);
        } catch (error) {
          logger.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    logger.error("💥 Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Only start server if this file is executed directly
if (require.main === module) {
  startServer();
}

export { app, prisma };
export default startServer;
