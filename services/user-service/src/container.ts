import "reflect-metadata";
import { container } from "tsyringe";
import { IUserRepository } from "./interfaces/repositories/IUserRepository";
import { UserRepository } from "./repositories/UserRepository";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 * This file sets up the dependency injection container for the application.
 */

// Register repositories
container.registerSingleton<IUserRepository>("IUserRepository", UserRepository);

export { container };
