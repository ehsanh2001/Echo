import "reflect-metadata";
import { container } from "tsyringe";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { RabbitMQConsumer } from "./workers/RabbitMQConsumer";
import { IInviteEventHandler } from "./interfaces/handlers/IInviteEventHandler";
import { InviteEventHandler } from "./handlers/InviteEventHandler";
import { IPasswordResetEventHandler } from "./interfaces/handlers/IPasswordResetEventHandler";
import { PasswordResetEventHandler } from "./handlers/PasswordResetEventHandler";
import { IEmailService } from "./interfaces/services/IEmailService";
import { EmailService } from "./services/EmailService";
import { SmtpEmailService } from "./services/SmtpEmailService";
import { ITemplateService } from "./interfaces/services/ITemplateService";
import { TemplateService } from "./services/TemplateService";
import { IUserServiceClient } from "./interfaces/services/IUserServiceClient";
import { UserServiceClient } from "./services/UserServiceClient";
import { config } from "./config/env";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 */

// ===== SERVICES =====

// Register EmailService or SmtpEmailService based on configuration
if (config.email.useSmtp) {
  container.registerSingleton<IEmailService>("IEmailService", SmtpEmailService);
  // Module-load-time logging - cannot use contextual logger here
  console.log("📧 Using SMTP Email Service (MailHog)");
} else {
  container.registerSingleton<IEmailService>("IEmailService", EmailService);
  // Module-load-time logging - cannot use contextual logger here
  console.log("📧 Using Resend Email Service");
}

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

// Register PasswordResetEventHandler as IPasswordResetEventHandler implementation
container.registerSingleton<IPasswordResetEventHandler>(
  "IPasswordResetEventHandler",
  PasswordResetEventHandler
);

// ===== WORKERS =====

// Register RabbitMQConsumer as IRabbitMQConsumer implementation
container.registerSingleton<IRabbitMQConsumer>(
  "IRabbitMQConsumer",
  RabbitMQConsumer
);

export { container };
