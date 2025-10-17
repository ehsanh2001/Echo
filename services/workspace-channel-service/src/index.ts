import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { config } from "./config/env";
import "./container"; // Auto-configure dependency injection
import { container } from "./container";
import { IOutboxPublisher } from "./interfaces/workers/IOutboxPublisher";

const prisma = new PrismaClient();
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Import routes after dependencies are configured
import workspaceRoutes from "./routes/workspaceRoutes";

// API routes - new routing structure
// Main path: /api/ws-ch
app.use("/api/ws-ch/workspaces", workspaceRoutes);

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
    console.error("Health check failed:", error);

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
    console.error("Unhandled error:", error);

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
    console.log("� Starting Workspace-Channel Service...");

    // Test database connection
    await prisma.$connect();
    console.log("✅ Database connection successful");

    // Start Outbox Publisher Worker
    const outboxPublisher =
      container.resolve<IOutboxPublisher>("IOutboxPublisher");
    await outboxPublisher.start();
    console.log("✅ Outbox Publisher Worker started");

    // Start the server
    const server = app.listen(config.port, () => {
      console.log(`🌐 Server running on port ${config.port}`);
      console.log(`🔧 Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log("🔌 HTTP server closed");

        try {
          // Stop Outbox Publisher Worker
          await outboxPublisher.stop();
          console.log("🛑 Outbox Publisher Worker stopped");

          await prisma.$disconnect();
          console.log("💾 Database connection closed");
          console.log("👋 Graceful shutdown complete");
          process.exit(0);
        } catch (error) {
          console.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("💥 Failed to start server:", error);
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
