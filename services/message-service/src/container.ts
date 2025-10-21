import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import { IMessageRepository } from "./interfaces/repositories/IMessageRepository";
import { MessageRepository } from "./repositories/MessageRepository";

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

// TODO: Register services when created
// TODO: Register workers when created

export { container };
