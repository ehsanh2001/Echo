import "reflect-metadata";
import { container } from "tsyringe";
import { IUserRepository } from "./interfaces/repositories/IUserRepository";
import { UserRepository } from "./repositories/UserRepository";
import { IPasswordResetRepository } from "./interfaces/repositories/IPasswordResetRepository";
import { PasswordResetRepository } from "./repositories/PasswordResetRepository";
import { IUserService } from "./interfaces/services/IUserService";
import { UserService } from "./services/userService";
import { IAuthService } from "./interfaces/services/IAuthService";
import { AuthService } from "./services/authService";
import { IRabbitMQService } from "./interfaces/services/IRabbitMQService";
import { RabbitMQService } from "./services/RabbitMQService";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 * This file sets up the dependency injection container for the application.
 */

// Register repositories
container.registerSingleton<IUserRepository>("IUserRepository", UserRepository);
container.registerSingleton<IPasswordResetRepository>(
  "IPasswordResetRepository",
  PasswordResetRepository
);

// Register services
container.registerSingleton<IUserService>("IUserService", UserService);
container.registerSingleton<IAuthService>("IAuthService", AuthService);
container.registerSingleton<IRabbitMQService>(
  "IRabbitMQService",
  RabbitMQService
);

export { container };
