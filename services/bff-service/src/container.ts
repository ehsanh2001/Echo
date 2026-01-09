import "reflect-metadata";
import { container } from "tsyringe";
import logger from "./utils/logger";
import { RedisService } from "./services/RedisService";
import { IRedisService } from "./interfaces/services/IRedisService";
import {
  INonCriticalEventHandler,
  IChannelDeletedEventHandler,
  IWorkspaceDeletedEventHandler,
  IPasswordResetEventHandler,
} from "./interfaces/handlers";
import {
  NonCriticalEventHandler,
  ChannelDeletedEventHandler,
  WorkspaceDeletedEventHandler,
  PasswordResetEventHandler,
} from "./handlers";

// Register logger as singleton
container.register("Logger", {
  useValue: logger,
});

// Register RedisService with interface pattern
container.register<IRedisService>("IRedisService", {
  useClass: RedisService,
});

// Register Socket Event Handlers
container.register<INonCriticalEventHandler>("INonCriticalEventHandler", {
  useClass: NonCriticalEventHandler,
});

container.register<IChannelDeletedEventHandler>("IChannelDeletedEventHandler", {
  useClass: ChannelDeletedEventHandler,
});

container.register<IWorkspaceDeletedEventHandler>(
  "IWorkspaceDeletedEventHandler",
  {
    useClass: WorkspaceDeletedEventHandler,
  }
);

container.register<IPasswordResetEventHandler>("IPasswordResetEventHandler", {
  useClass: PasswordResetEventHandler,
});

// Note: RabbitMQConsumer is registered manually in index.ts with Socket.IO instance
// It requires the io instance which is created during server initialization

export { container };
