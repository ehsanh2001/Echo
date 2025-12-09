import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { correlationMiddleware, createHttpLogger } from "@echo/correlation";
import logger from "./utils/logger";
import { config } from "./config/env";
import { container } from "./container"; // Auto-configure dependency injection
import { IRabbitMQService } from "./interfaces/services/IRabbitMQService";
import { messageRoutes } from "./routes/messageRoutes";

const prisma = new PrismaClient();
const app = express();

// Correlation middleware (MUST be first)
app.use(correlationMiddleware("message-service"));
app.use(createHttpLogger(logger));

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
      error: error instanceof Error ? error.message : "Unknown error",
    };

    res.status(503).json(unhealthyInfo);
  }
});

// API routes
app.use("/api/messages", messageRoutes);

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
          : "An unexpected error occurred",
      service: config.service.name,
    });
  }
);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("✅ Database connected");

    const server = app.listen(config.port, () => {
      logger.info(`🚀 ${config.service.name} running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🏥 Health check: http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("✅ HTTP server closed");

        try {
          // Get RabbitMQ service for cleanup
          const rabbitMQService =
            container.resolve<IRabbitMQService>("IRabbitMQService");
          await rabbitMQService.close();
          logger.info("✅ RabbitMQ disconnected");

          await prisma.$disconnect();
          logger.info("✅ Database disconnected");
          process.exit(0);
        } catch (error) {
          logger.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("⚠️  Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
