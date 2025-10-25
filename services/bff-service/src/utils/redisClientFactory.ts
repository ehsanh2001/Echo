import { createClient, RedisClientType } from "redis";
import { config } from "../config/env";
import logger from "./logger";

/**
 * Factory function to create Redis clients with standardized configuration
 * Used for cache service and Socket.IO pub/sub clients
 *
 * @param clientName - Name for logging purposes (e.g., "Cache client", "Socket.IO pub client")
 * @param autoConnect - Whether to automatically connect the client (default: false)
 * @returns Configured Redis client instance
 */
export function createRedisClient(
  clientName: string,
  autoConnect: boolean = false
): RedisClientType {
  const client = createClient({
    url: config.redis.url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error(`${clientName}: Too many reconnection attempts`);
          return new Error("Too many reconnection attempts");
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(
          `${clientName}: Reconnecting in ${delay}ms (attempt ${retries})`
        );
        return delay;
      },
    },
  }) as RedisClientType;

  // Register event handlers
  client.on("error", (err) => {
    logger.error(`${clientName} error`, { error: err });
  });

  client.on("connect", () => {
    logger.info(`${clientName} connecting...`);
  });

  client.on("ready", () => {
    logger.info(`✅ ${clientName} ready`);
  });

  client.on("reconnecting", () => {
    logger.warn(`${clientName} reconnecting...`);
  });

  client.on("end", () => {
    logger.info(`${clientName} connection closed`);
  });

  // Auto-connect if requested
  if (autoConnect) {
    client.connect().catch((err) => {
      logger.error(`${clientName}: Failed to connect`, { error: err });
    });
  }

  return client;
}
