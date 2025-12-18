import { injectable } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import { config } from "../config/env";
import logger from "../utils/logger";
import { EnrichedUserInfo } from "../types";

/**
 * Service for caching user data in Redis
 *
 * Provides methods to cache and retrieve user information with automatic TTL management.
 * Used to reduce load on user-service by caching frequently accessed user profiles.
 */
@injectable()
export class CacheService {
  private client: RedisClientType | null = null;
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly KEY_PREFIX = "user:profile:";

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initializes Redis client connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.client = createClient({
        url: config.redis.url,
        password: config.redis.password,
      });

      this.client.on("error", (err) => {
        logger.error("Redis client error", { error: err });
      });

      this.client.on("connect", () => {
        logger.info("Redis client connected");
      });

      await this.client.connect();
    } catch (error) {
      logger.error("Failed to initialize Redis client", { error });
      // Don't throw - allow service to run without cache
      this.client = null;
    }
  }

  /**
   * Gets cached user data by user ID
   *
   * @param userId - User ID to lookup
   * @returns Cached user info or null if not found/expired
   */
  async getCachedUser(userId: string): Promise<EnrichedUserInfo | null> {
    if (!this.client) {
      logger.warn("Redis client not available");
      return null;
    }

    try {
      const key = `${this.KEY_PREFIX}${userId}`;
      const cached = await this.client.get(key);

      if (!cached) {
        return null;
      }

      const user = JSON.parse(cached) as EnrichedUserInfo;
      // Parse lastSeen back to Date if it exists
      if (user.lastSeen) {
        user.lastSeen = new Date(user.lastSeen);
      }

      logger.debug("Cache hit for user", { userId });
      return user;
    } catch (error) {
      logger.error("Error getting cached user", { userId, error });
      return null;
    }
  }

  /**
   * Caches user data with TTL
   *
   * @param userId - User ID to cache
   * @param user - User info to cache
   */
  async setCachedUser(userId: string, user: EnrichedUserInfo): Promise<void> {
    if (!this.client) {
      logger.warn("Redis client not available");
      return;
    }

    try {
      const key = `${this.KEY_PREFIX}${userId}`;
      await this.client.setEx(key, this.CACHE_TTL, JSON.stringify(user));
      logger.debug("Cached user", { userId });
    } catch (error) {
      logger.error("Error caching user", { userId, error });
    }
  }

  /**
   * Gets multiple cached users by their IDs
   *
   * @param userIds - Array of user IDs to lookup
   * @returns Map of userId -> user info for found entries
   */
  async getCachedUsers(
    userIds: string[]
  ): Promise<Map<string, EnrichedUserInfo>> {
    const result = new Map<string, EnrichedUserInfo>();

    if (!this.client || userIds.length === 0) {
      return result;
    }

    try {
      const keys = userIds.map((id) => `${this.KEY_PREFIX}${id}`);
      const cached = await this.client.mGet(keys);

      cached.forEach((value, index) => {
        if (value) {
          try {
            const user = JSON.parse(value) as EnrichedUserInfo;
            // Parse lastSeen back to Date if it exists
            if (user.lastSeen) {
              user.lastSeen = new Date(user.lastSeen);
            }
            result.set(userIds[index]!, user);
          } catch (error) {
            logger.error("Error parsing cached user", {
              userId: userIds[index],
              error,
            });
          }
        }
      });

      logger.debug("Cache bulk lookup", {
        requested: userIds.length,
        found: result.size,
      });
    } catch (error) {
      logger.error("Error getting cached users", { error });
    }

    return result;
  }

  /**
   * Caches multiple users with TTL
   *
   * @param users - Array of user info to cache
   */
  async setCachedUsers(users: EnrichedUserInfo[]): Promise<void> {
    if (!this.client || users.length === 0) {
      return;
    }

    try {
      // Use pipeline for efficient bulk operations
      const pipeline = this.client.multi();

      users.forEach((user) => {
        const key = `${this.KEY_PREFIX}${user.id}`;
        pipeline.setEx(key, this.CACHE_TTL, JSON.stringify(user));
      });

      await pipeline.exec();
      logger.debug("Cached users in bulk", { count: users.length });
    } catch (error) {
      logger.error("Error caching users in bulk", { error });
    }
  }

  /**
   * Invalidates cached user data
   *
   * @param userId - User ID to invalidate
   */
  async invalidateUser(userId: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const key = `${this.KEY_PREFIX}${userId}`;
      await this.client.del(key);
      logger.debug("Invalidated user cache", { userId });
    } catch (error) {
      logger.error("Error invalidating user cache", { userId, error });
    }
  }

  /**
   * Closes Redis connection
   * Called during graceful shutdown
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      logger.info("Redis client disconnected");
    }
  }
}
