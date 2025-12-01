import "reflect-metadata";
import { container } from "tsyringe";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { RabbitMQConsumer } from "./workers/RabbitMQConsumer";
import { IInviteEventHandler } from "./interfaces/handlers/IInviteEventHandler";
import { InviteEventHandler } from "./handlers/InviteEventHandler";
import { IEmailService } from "./interfaces/services/IEmailService";
import { EmailService } from "./services/EmailService";
import { ITemplateService } from "./interfaces/services/ITemplateService";
import { TemplateService } from "./services/TemplateService";
import { IUserServiceClient } from "./interfaces/services/IUserServiceClient";
import { UserServiceClient } from "./services/UserServiceClient";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 */

// ===== SERVICES =====

// Register EmailService as IEmailService implementation
container.registerSingleton<IEmailService>("IEmailService", EmailService);

// Register TemplateService as ITemplateService implementation
container.registerSingleton<ITemplateService>(
  "ITemplateService",
  TemplateService
);

// Register UserServiceClient as IUserServiceClient implementation
container.registerSingleton<IUserServiceClient>(
  "IUserServiceClient",
  UserServiceClient
);

// ===== HANDLERS =====

// Register InviteEventHandler as IInviteEventHandler implementation
container.registerSingleton<IInviteEventHandler>(
  "IInviteEventHandler",
  InviteEventHandler
);

// ===== WORKERS =====

// Register RabbitMQConsumer as IRabbitMQConsumer implementation
container.registerSingleton<IRabbitMQConsumer>(
  "IRabbitMQConsumer",
  RabbitMQConsumer
);

export { container };
