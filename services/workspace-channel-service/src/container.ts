import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";

// Import interfaces
import { IWorkspaceRepository } from "./interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "./interfaces/repositories/IChannelRepository";
import { IInviteRepository } from "./interfaces/repositories/IInviteRepository";
import { IOutboxRepository } from "./interfaces/repositories/IOutboxRepository";
import { IWorkspaceService } from "./interfaces/services/IWorkspaceService";
import { IInviteService } from "./interfaces/services/IInviteService";
import { IOutboxService } from "./interfaces/services/IOutboxService";

// Import implementations
import { WorkspaceRepository } from "./repositories/WorkspaceRepository";
import { ChannelRepository } from "./repositories/ChannelRepository";
import { InviteRepository } from "./repositories/InviteRepository";
import { OutboxRepository } from "./repositories/OutboxRepository";
import { WorkspaceService } from "./services/WorkspaceService";
import { InviteService } from "./services/InviteService";
import { OutboxService } from "./services/OutboxService";
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
container.registerSingleton<IInviteRepository>(
  "IInviteRepository",
  InviteRepository
);
container.registerSingleton<IOutboxRepository>(
  "IOutboxRepository",
  OutboxRepository
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
container.registerSingleton<IInviteService>("IInviteService", InviteService);
container.registerSingleton<IOutboxService>("IOutboxService", OutboxService);

console.log("✅ Dependency injection container configured");

export { container };
