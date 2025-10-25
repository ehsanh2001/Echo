import "reflect-metadata";
import { container } from "tsyringe";
import logger from "./utils/logger";
import { RedisService } from "./services/RedisService";
import { IRedisService } from "./interfaces/services/IRedisService";

// Register logger as singleton
container.register("Logger", {
  useValue: logger,
});

// Register RedisService with interface pattern
container.register<IRedisService>("IRedisService", {
  useClass: RedisService,
});

// Note: RabbitMQConsumer is registered manually in index.ts with Socket.IO instance
// It requires the io instance which is created during server initialization

export { container };
