import "reflect-metadata";
import { container } from "tsyringe";
import logger from "./utils/logger";

// Register logger as singleton
container.register("Logger", {
  useValue: logger,
});

// Redis client and RabbitMQ connection will be registered in their respective config files
// They will be imported and used in src/index.ts during startup

export { container };
