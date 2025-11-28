import "reflect-metadata";
import { container } from "tsyringe";
import { IRabbitMQConsumer } from "./interfaces/workers/IRabbitMQConsumer";
import { RabbitMQConsumer } from "./workers/RabbitMQConsumer";
import { IInviteEventHandler } from "./interfaces/handlers/IInviteEventHandler";
import { InviteEventHandler } from "./handlers/InviteEventHandler";

/**
 * Dependency Injection Container Configuration
 *
 * Registers all injectable services and their implementations.
 */

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
