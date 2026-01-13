// OpenTelemetry must be initialized FIRST before any other imports
import "@echo/telemetry";

import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { requestContextMiddleware } from "@echo/telemetry";
import { createHttpStream } from "@echo/logger";
import { metricsMiddleware, metricsEndpoint } from "@echo/metrics";
import logger from "./utils/logger";
import { config } from "./config/env";
import { container } from "./container"; // Auto-configure dependency injection
import { IRabbitMQService } from "./interfaces/services/IRabbitMQService";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { IHealthService } from "./interfaces/services/IHealthService";
import { messageRoutes } from "./routes/messageRoutes";
import { readReceiptRoutes } from "./routes/readReceiptRoutes";
import morgan from "morgan";

const prisma = new PrismaClient();
const app = express();

// Metrics endpoint FIRST - before any other middleware (no auth, no rate limit)
app.get("/metrics", metricsEndpoint());

// Initialize metrics collection
app.use(metricsMiddleware({ serviceName: "message-service" }));

// Request context middleware - sets up OTel context
app.use(requestContextMiddleware());
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

// Health check endpoint
app.get("/health", async (req, res) => {
  const healthService = container.resolve<IHealthService>("IHealthService");
  const { response, statusCode } = await healthService.checkHealth(
    config.service.name,
    "1.0.0"
  );
  res.status(statusCode).json(response);
});

// Kubernetes-style liveness probe - if fails, container should be restarted
app.get("/health/live", async (req, res) => {
  const healthService = container.resolve<IHealthService>("IHealthService");
  const { response, statusCode } = await healthService.checkLiveness(
    config.service.name,
    "1.0.0"
  );
  res.status(statusCode).json(response);
});

// Kubernetes-style readiness probe - if fails, traffic should not be routed
app.get("/health/ready", async (req, res) => {
  const healthService = container.resolve<IHealthService>("IHealthService");
  const { response, statusCode } = await healthService.checkReadiness(
    config.service.name,
    "1.0.0"
  );
  res.status(statusCode).json(response);
});

// API routes
app.use("/api/messages", messageRoutes);
app.use("/api/messages", readReceiptRoutes);

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

    // Initialize RabbitMQ consumer for channel.deleted events
    const rabbitMQConsumer =
      container.resolve<IRabbitMQConsumer>("IRabbitMQConsumer");
    await rabbitMQConsumer.initialize();
    logger.info("✅ RabbitMQ consumer initialized");

    const server = app.listen(config.port, () => {
      logger.info(`🚀 ${config.service.name} running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🏥 Health check: http://localhost:${config.port}/health`);
      logger.info(`❤️  Liveness: http://localhost:${config.port}/health/live`);
      logger.info(`✅ Readiness: http://localhost:${config.port}/health/ready`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("✅ HTTP server closed");

        try {
          // Close RabbitMQ consumer
          await rabbitMQConsumer.close();
          logger.info("✅ RabbitMQ consumer disconnected");

          // Get RabbitMQ service for cleanup
          const rabbitMQService =
            container.resolve<IRabbitMQService>("IRabbitMQService");
          await rabbitMQService.close();
          logger.info("✅ RabbitMQ publisher disconnected");

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
