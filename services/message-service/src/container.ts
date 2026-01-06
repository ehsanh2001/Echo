import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import logger from "./utils/logger";
import { IMessageRepository } from "./interfaces/repositories/IMessageRepository";
import { MessageRepository } from "./repositories/MessageRepository";
import { ICacheService } from "./interfaces/services/ICacheService";
import { CacheService } from "./services/CacheService";
import { IMessageService } from "./interfaces/services/IMessageService";
import { MessageService } from "./services/MessageService";
import { IRabbitMQService } from "./interfaces/services/IRabbitMQService";
import { RabbitMQService } from "./services/RabbitMQService";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { RabbitMQConsumer } from "./workers/RabbitMQConsumer";
import { IHealthService } from "./interfaces/services/IHealthService";
import { HealthService } from "./services/HealthService";
import { IUserServiceClient } from "./interfaces/external/IUserServiceClient";
import { UserServiceClient } from "./services/UserServiceClient";
import { IWorkspaceChannelServiceClient } from "./interfaces/external/IWorkspaceChannelServiceClient";
import { WorkspaceChannelServiceClient } from "./services/WorkspaceChannelServiceClient";
import { MessageController } from "./controllers/MessageController";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 * This file will be expanded as we add repositories and services.
 */

// Register PrismaClient instance as singleton
const prismaClient = new PrismaClient();
container.registerInstance<PrismaClient>(PrismaClient, prismaClient);

// ===== REPOSITORIES =====

// Register MessageRepository as IMessageRepository implementation
container.registerSingleton<IMessageRepository>(
  "IMessageRepository",
  MessageRepository
);

// ===== SERVICES =====

// Register HealthService as IHealthService implementation (must be registered first for other services to inject)
container.registerSingleton<IHealthService>("IHealthService", HealthService);

// Register CacheService as ICacheService implementation
container.registerSingleton<ICacheService>("ICacheService", CacheService);

// Register MessageService as IMessageService implementation
container.registerSingleton<IMessageService>("IMessageService", MessageService);

// Register RabbitMQService as IRabbitMQService implementation and initialize
const rabbitMQService = new RabbitMQService();

// Wire up health service to RabbitMQ service (after HealthService is registered)
const healthService = container.resolve<IHealthService>("IHealthService");
rabbitMQService.setHealthService(healthService);

rabbitMQService.initialize().catch((error) => {
  logger.error("❌ Failed to initialize RabbitMQ during startup:", error);
  // Don't throw - allow service to start even if RabbitMQ is unavailable
});
container.registerInstance<IRabbitMQService>(
  "IRabbitMQService",
  rabbitMQService
);

// ===== EXTERNAL SERVICE CLIENTS =====

// Register UserServiceClient as IUserServiceClient implementation
container.registerSingleton<IUserServiceClient>(
  "IUserServiceClient",
  UserServiceClient
);

// Register WorkspaceChannelServiceClient as IWorkspaceChannelServiceClient implementation
container.registerSingleton<IWorkspaceChannelServiceClient>(
  "IWorkspaceChannelServiceClient",
  WorkspaceChannelServiceClient
);

// ===== CONTROLLERS =====

// Register MessageController
container.registerSingleton<MessageController>(MessageController);

// ===== WORKERS =====

// Register RabbitMQConsumer as IRabbitMQConsumer implementation
// Note: Initialization is done in index.ts after all services are registered
container.registerSingleton<IRabbitMQConsumer>(
  "IRabbitMQConsumer",
  RabbitMQConsumer
);

export { container };
