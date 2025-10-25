import "reflect-metadata";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "./config/env";
import "./container"; // Auto-configure dependency injection
import { container } from "./container";
import logger from "./utils/logger";
import { createRedisClient } from "./utils/redisClientFactory";
import { IRedisService } from "./interfaces/services/IRedisService";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO server (Redis adapter will be set up in startServer)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.externalServices.frontendBaseUrl,
    credentials: true,
  },
  pingTimeout: config.socketIO.pingTimeout,
  pingInterval: config.socketIO.pingInterval,
});

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.externalServices.frontendBaseUrl,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const healthInfo = {
    status: "healthy",
    service: config.service.name,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    socketIO: {
      connected: io.engine.clientsCount,
    },
  };

  res.status(200).json(healthInfo);
});

// Import routes after dependencies are configured
// TODO: Import routes when created
// import bffRoutes from "./routes";
// app.use("/api/bff", bffRoutes);

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
    logger.error(`Unhandled error: ${error.message}`, { stack: error.stack });

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

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // TODO: Add authentication middleware for sockets
  // TODO: Handle socket events (join workspace, join channel, etc.)

  socket.on("disconnect", (reason) => {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on("error", (error) => {
    logger.error(`Socket error: ${socket.id}`, { error });
  });
});

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, forcing exit...");
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });

  // Close Socket.IO connections
  io.close(() => {
    logger.info("Socket.IO server closed");
  });

  // Close Redis connections
  const redisService = container.resolve<IRedisService>("IRedisService");
  try {
    await redisService.closeConnection();
  } catch (error) {
    logger.error("Error closing Redis connection", { error });
  }

  // Close Socket.IO Redis clients
  try {
    if (socketIOPubClient?.isOpen) await socketIOPubClient.quit();
    if (socketIOSubClient?.isOpen) await socketIOSubClient.quit();
    logger.info("✅ Socket.IO Redis clients closed");
  } catch (error) {
    logger.error("Error closing Socket.IO Redis clients", { error });
  }

  // TODO: Close RabbitMQ connections when implemented

  // Give pending operations time to complete
  setTimeout(() => {
    logger.info("Graceful shutdown complete");
    process.exit(0);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Socket.IO Redis clients for horizontal scaling (module-level to access in shutdown)
let socketIOPubClient: ReturnType<typeof createRedisClient>;
let socketIOSubClient: ReturnType<typeof createRedisClient>;

// Start server
async function startServer() {
  try {
    logger.info("🚀 Starting BFF Service...");

    // Create dedicated Redis clients for Socket.IO pub/sub
    // These are separate from the cache service client
    socketIOPubClient = createRedisClient("Socket.IO Pub Client", true);
    socketIOSubClient = createRedisClient("Socket.IO Sub Client", true);

    // Set up Socket.IO Redis adapter for horizontal scaling
    // This allows multiple BFF instances to communicate and share socket state
    // No sticky sessions required - clients can connect to any instance
    io.adapter(createAdapter(socketIOPubClient, socketIOSubClient));
    logger.info("✅ Socket.IO Redis adapter configured for horizontal scaling");

    // TODO: Initialize RabbitMQ consumer

    httpServer.listen(config.port, () => {
      logger.info(`✅ BFF Service listening on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Socket.IO server ready with Redis adapter`);
      logger.info(
        `Instance can be scaled horizontally - no sticky sessions required`
      );
    });
  } catch (error) {
    logger.error("Failed to start BFF Service", { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  gracefulShutdown("unhandledRejection");
});

startServer();

// Export for testing
export { app, httpServer, io };
