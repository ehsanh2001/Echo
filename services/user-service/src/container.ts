import "reflect-metadata";
import { container } from "tsyringe";
import { IUserRepository } from "./interfaces/repositories/IUserRepository";
import { UserRepository } from "./repositories/UserRepository";
import { IUserService } from "./interfaces/services/IUserService";
import { UserService } from "./services/userService";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 * This file sets up the dependency injection container for the application.
 */

// Register repositories
container.registerSingleton<IUserRepository>("IUserRepository", UserRepository);

// Register services
container.registerSingleton<IUserService>("IUserService", UserService);

export { container };
