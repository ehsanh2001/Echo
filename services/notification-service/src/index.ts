import "reflect-metadata";
import express, { Request, Response } from "express";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { container } from "./container";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { ITemplateService } from "./interfaces/services/ITemplateService";

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
    // Start Express server
    app.listen(config.port, () => {
      logger.info(`🚀 ${config.service.name} started successfully`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        rabbitmqExchange: config.rabbitmq.exchange,
        rabbitmqQueue: config.rabbitmq.queue,
      });
    });

    // Initialize TemplateService (load partials and helpers)
    const templateService =
      container.resolve<ITemplateService>("ITemplateService");
    await templateService.initialize();

    // Resolve and initialize RabbitMQ consumer from container
    const rabbitMQConsumer =
      container.resolve<IRabbitMQConsumer>("IRabbitMQConsumer");

    try {
      await rabbitMQConsumer.initialize();
      logger.info("✅ All services initialized");
    } catch (error) {
      logger.error("Failed to initialize RabbitMQ on startup", { error });
      logger.warn("Service will continue - RabbitMQ will attempt reconnection");
      // Don't exit - let the service run and RabbitMQ will reconnect automatically
      // The reconnection is handled by event handlers on the connection
    }
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Resolve and close RabbitMQ consumer from container
    const rabbitMQConsumer =
      container.resolve<IRabbitMQConsumer>("IRabbitMQConsumer");
    await rabbitMQConsumer.close();

    logger.info("✅ Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", { error });
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start the application
startServer();
