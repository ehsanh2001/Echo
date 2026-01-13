// OpenTelemetry must be initialized FIRST before any other imports
import "@echo/telemetry";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requestContextMiddleware } from "@echo/telemetry";
import { createHttpStream } from "@echo/logger";
import { metricsMiddleware, metricsEndpoint } from "@echo/metrics";
import { config } from "./config/env";
import logger from "./utils/logger";
import userRoutes from "./routes/userRoutes";
import { prisma } from "./config/prisma";
import morgan from "morgan";

const app = express();

// Metrics endpoint FIRST - before any other middleware (no auth, no rate limit)
app.get("/metrics", metricsEndpoint());

// Initialize metrics collection
app.use(metricsMiddleware({ serviceName: "user-service" }));

// Request context middleware - sets up OTel context
app.use(requestContextMiddleware());

// HTTP request logging
app.use(morgan("combined", { stream: createHttpStream(logger) }));

app.use(helmet());
app.use(cors());

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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/users/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "user-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/users", userRoutes);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

async function startServer() {
  try {
    await prisma.$connect();
    logger.info("Database connection established successfully");

    app.listen(config.port, () => {
      logger.info(`User Service running on port ${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

if (require.main === module) {
  startServer();
}
