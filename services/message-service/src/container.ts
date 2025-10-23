import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import { IMessageRepository } from "./interfaces/repositories/IMessageRepository";
import { MessageRepository } from "./repositories/MessageRepository";
import { ICacheService } from "./interfaces/services/ICacheService";
import { CacheService } from "./services/CacheService";
import { IMessageService } from "./interfaces/services/IMessageService";
import { MessageService } from "./services/MessageService";
import { IRabbitMQService } from "./interfaces/services/IRabbitMQService";
import { RabbitMQService } from "./services/RabbitMQService";
import { IUserServiceClient } from "./interfaces/external/IUserServiceClient";
import { UserServiceClient } from "./services/UserServiceClient";
import { IWorkspaceChannelServiceClient } from "./interfaces/external/IWorkspaceChannelServiceClient";
import { WorkspaceChannelServiceClient } from "./services/WorkspaceChannelServiceClient";

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

// Register CacheService as ICacheService implementation
container.registerSingleton<ICacheService>("ICacheService", CacheService);

// Register MessageService as IMessageService implementation
container.registerSingleton<IMessageService>("IMessageService", MessageService);

// Register RabbitMQService as IRabbitMQService implementation and initialize
const rabbitMQService = new RabbitMQService();
rabbitMQService.initialize().catch((error) => {
  console.error("❌ Failed to initialize RabbitMQ during startup:", error);
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

// TODO: Register controllers when created
// TODO: Register workers when created

export { container };
