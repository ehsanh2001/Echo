import express, { Request, Response } from "express";
import { config } from "./config/env";
import { logger } from "./config/logger";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: config.service.name,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const startServer = async () => {
  try {
    app.listen(config.port, () => {
      logger.info(`🚀 ${config.service.name} started successfully`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        rabbitmqExchange: config.rabbitmq.exchange,
        rabbitmqQueue: config.rabbitmq.queue,
      });
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // TODO: Close RabbitMQ connection
  // TODO: Close database connections if needed

  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start the application
startServer();
