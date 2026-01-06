import { injectable, inject } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import logger from "../utils/logger";
import { ICacheService } from "../interfaces/services/ICacheService";
import { IHealthService } from "../interfaces/services/IHealthService";
import { config } from "../config/env";

/**
 * Redis-based cache service implementation
 * Provides centralized caching functionality with automatic serialization/deserialization
 */
@injectable()
export class CacheService implements ICacheService {
  private readonly redis: RedisClientType;
  private readonly keyPrefix: string;

  constructor(
    @inject("IHealthService") private readonly healthService: IHealthService
  ) {
    // Create and configure Redis client internally
    this.redis = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });

    this.keyPrefix = config.redis.keyPrefix;

    // Set up event listeners
    this.redis.on("error", (err) => {
      logger.error("Redis connection error:", err);
      this.healthService.setRedisHealth(false);
    });

    this.redis.on("connect", () => {
      logger.info("Redis connected successfully");
      this.healthService.setRedisHealth(true);
    });

    this.redis.on("reconnecting", () => {
      logger.info("Redis reconnecting...");
      this.healthService.setRedisHealth(false);
    });

    this.redis.on("ready", () => {
      logger.info("Redis ready");
      this.healthService.setRedisHealth(true);
    });

    // Connect to Redis
    this.redis.connect().catch((err) => {
      logger.error("Redis connect error:", err);
      this.healthService.setRedisHealth(false);
    });
  }

  /**
   * Get a value from cache with automatic JSON deserialization
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cachedValue = await this.redis.get(key);

      if (!cachedValue) {
        return null;
      }

      // Parse JSON and return parsed value
      const parsed = JSON.parse(cachedValue);
      return parsed as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with automatic JSON serialization
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setEx(key, ttlSeconds, serializedValue);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      // Don't throw - cache failures should not break the application
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   * Uses Redis SCAN to avoid blocking on large keyspaces
   */
  async deleteByPattern(pattern: string): Promise<number> {
    let deletedCount = 0;
    let cursor = "0";

    try {
      // Use SCAN to iterate through keys without blocking
      do {
        const result = await this.redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100, // Process in batches of 100
        });

        cursor = String(result.cursor);
        const keys = result.keys;

        if (keys.length > 0) {
          const deleted = await this.redis.del(keys);
          deletedCount += deleted;
          logger.debug(`Deleted ${deleted} keys matching pattern: ${pattern}`);
        }
      } while (cursor !== "0");

      logger.info(`Cache deleteByPattern completed`, {
        pattern,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error(
        `Cache deleteByPattern error for pattern ${pattern}:`,
        error
      );
      return deletedCount;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) {
      return [];
    }

    try {
      const cachedValues = await this.redis.mGet(keys);

      return cachedValues.map((value) => {
        if (!value) {
          return null;
        }

        try {
          const parsed = JSON.parse(value);
          return parsed as T;
        } catch (error) {
          logger.error(`Error deserializing cached value:`, error);
          return null;
        }
      });
    } catch (error) {
      logger.error(
        `Cache getMultiple error for keys ${keys.join(", ")}:`,
        error
      );
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache with same TTL
   */
  async setMultiple<T>(
    entries: Array<{ key: string; value: T }>,
    ttlSeconds: number
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      // Use pipeline for better performance
      const pipeline = this.redis.multi();

      for (const { key, value } of entries) {
        const serializedValue = JSON.stringify(value);
        pipeline.setEx(key, ttlSeconds, serializedValue);
      }

      await pipeline.exec();
    } catch (error) {
      logger.error(`Cache setMultiple error:`, error);
      // Don't throw - cache failures should not break the application
    }
  }

  /**
   * Generate cache key with service prefix
   */
  buildKey(...parts: string[]): string {
    return `${this.keyPrefix}${parts.join(":")}`;
  }
}
