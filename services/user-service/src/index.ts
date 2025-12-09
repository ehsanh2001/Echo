import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { correlationMiddleware, createHttpLogger } from "@echo/correlation";
import { config } from "./config/env";
import logger from "./utils/logger";
import userRoutes from "./routes/userRoutes";
import { prisma } from "./config/prisma";

const app = express();

// Correlation middleware - MUST BE FIRST
app.use(correlationMiddleware("user-service"));

// HTTP request logging with correlation context
app.use(createHttpLogger(logger));

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
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
