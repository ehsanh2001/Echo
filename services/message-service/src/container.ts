import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 * This file will be expanded as we add repositories and services.
 */

// Register PrismaClient instance as singleton
const prismaClient = new PrismaClient();
container.registerInstance<PrismaClient>(PrismaClient, prismaClient);

// TODO: Register repositories when created
// TODO: Register services when created
// TODO: Register workers when created

export { container };
