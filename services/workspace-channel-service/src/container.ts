import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";

// Import interfaces
import { IWorkspaceRepository } from "./interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "./interfaces/repositories/IChannelRepository";
import { IWorkspaceService } from "./interfaces/services/IWorkspaceService";

// Import implementations
import { WorkspaceRepository } from "./repositories/WorkspaceRepository";
import { ChannelRepository } from "./repositories/ChannelRepository";
import { WorkspaceService } from "./services/WorkspaceService";
import { UserServiceClient } from "./services/userServiceClient";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 */

// Register PrismaClient instance as singleton
const prismaClient = new PrismaClient();
container.registerInstance<PrismaClient>(PrismaClient, prismaClient);

// Register repositories
container.registerSingleton<IWorkspaceRepository>(
  "IWorkspaceRepository",
  WorkspaceRepository
);
container.registerSingleton<IChannelRepository>(
  "IChannelRepository",
  ChannelRepository
);

// Register services
container.registerSingleton<UserServiceClient>(
  "UserServiceClient",
  UserServiceClient
);
container.registerSingleton<IWorkspaceService>(
  "IWorkspaceService",
  WorkspaceService
);

console.log("✅ Dependency injection container configured");

export { container };
