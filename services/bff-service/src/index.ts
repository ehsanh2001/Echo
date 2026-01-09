// OpenTelemetry must be initialized FIRST before any other imports
import "@echo/telemetry";

import "reflect-metadata";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { requestContextMiddleware } from "@echo/telemetry";
import { createHttpStream } from "@echo/logger";
import {
  metricsMiddleware,
  metricsEndpoint,
  createWebSocketConnectionsGauge,
} from "@echo/metrics";
import { config } from "./config/env";
import "./container"; // Auto-configure dependency injection
import { container } from "./container";
import logger from "./utils/logger";
import { createRedisClient } from "./utils/redisClientFactory";
import { IRedisService } from "./interfaces/services/IRedisService";
import { RabbitMQConsumer } from "./workers/RabbitMQConsumer";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { socketAuth, AuthenticatedSocket } from "./middleware/auth";
import bffRoutes from "./routes";
import morgan from "morgan";
import { setSocketIO } from "./utils/socketIO";

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

// Make Socket.IO instance globally accessible for controllers/services
setSocketIO(io);

// WebSocket connections gauge for metrics
const wsConnectionsGauge = createWebSocketConnectionsGauge();

// Metrics endpoint FIRST - before any other middleware (no auth, no rate limit)
app.get("/metrics", metricsEndpoint());

// Initialize metrics collection
app.use(metricsMiddleware({ serviceName: "bff-service" }));

// Request context middleware - sets up OTel context
app.use(requestContextMiddleware());

// HTTP request logging
app.use(morgan("combined", { stream: createHttpStream(logger) }));

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.externalServices.frontendBaseUrl,
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "traceparent", // W3C Trace Context
      "tracestate", // W3C Trace Context (vendor info)
      "baggage", // OTel Baggage propagation
    ],
    exposedHeaders: [
      "X-Request-ID",
      "X-Trace-ID", // Return trace ID to frontend
    ],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/metrics", // Skip rate limiting for metrics
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
    socketIO: {
      connected: io.engine.clientsCount,
    },
  };

  res.status(200).json(healthInfo);
});

// Mount API routes
app.use("/api", bffRoutes);

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
// Socket.IO connection handling with authentication
io.use(socketAuth);
logger.info("Socket.IO authentication middleware configured");

io.on("connection", (socket: AuthenticatedSocket) => {
  const userId = socket.user!.userId;
  logger.info(`Socket connected: ${socket.id}, User: ${userId}`);

  // Track WebSocket connection for metrics
  wsConnectionsGauge.inc();

  // Auto-join user-specific room for direct notifications
  socket.join(`user:${userId}`);

  // Handle joining workspace rooms
  socket.on("join_workspace", (workspaceId: string) => {
    socket.join(`workspace:${workspaceId}`);
    logger.info(`User ${userId} joined workspace: ${workspaceId}`);
  });

  // Handle joining channel rooms
  socket.on(
    "join_channel",
    (data: { workspaceId: string; channelId: string }) => {
      const room = `workspace:${data.workspaceId}:channel:${data.channelId}`;
      socket.join(room);
      logger.info(`User ${userId} joined channel: ${data.channelId}`);
    }
  );

  // Handle leaving workspace rooms
  socket.on("leave_workspace", (workspaceId: string) => {
    socket.leave(`workspace:${workspaceId}`);
    logger.info(`User ${userId} left workspace: ${workspaceId}`);
  });

  // Handle leaving channel rooms
  socket.on(
    "leave_channel",
    (data: { workspaceId: string; channelId: string }) => {
      const room = `workspace:${data.workspaceId}:channel:${data.channelId}`;
      socket.leave(room);
      logger.info(`User ${userId} left channel: ${data.channelId}`);
    }
  );

  socket.on("disconnect", (reason) => {
    // Track WebSocket disconnection for metrics
    wsConnectionsGauge.dec();
    logger.info(
      `Socket disconnected: ${socket.id}, User: ${userId}, reason: ${reason}`
    );
  });

  socket.on("error", (error) => {
    logger.error(`Socket error: ${socket.id}, User: ${userId}`, { error });
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

  // Close RabbitMQ consumer
  try {
    if (rabbitmqConsumer) {
      await rabbitmqConsumer.close();
    }
  } catch (error) {
    logger.error("Error closing RabbitMQ consumer", { error });
  }

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
let rabbitmqConsumer: IRabbitMQConsumer;

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

    // Initialize RabbitMQ consumer to broadcast events to Socket.IO clients
    // Resolve from DI container and pass Socket.IO server
    rabbitmqConsumer = container.resolve(RabbitMQConsumer);
    rabbitmqConsumer.setSocketServer(io);
    await rabbitmqConsumer.initialize();

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
  logger.error("Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise,
  });
  gracefulShutdown("unhandledRejection");
});

startServer();

// Export for testing
export { app, httpServer, io };
