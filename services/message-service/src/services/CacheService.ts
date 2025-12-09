import { injectable } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import logger from "../utils/logger";
import { ICacheService } from "../interfaces/services/ICacheService";
import { config } from "../config/env";

/**
 * Redis-based cache service implementation
 * Provides centralized caching functionality with automatic serialization/deserialization
 */
@injectable()
export class CacheService implements ICacheService {
  private readonly redis: RedisClientType;
  private readonly keyPrefix: string;

  constructor() {
    // Create and configure Redis client internally
    this.redis = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });

    this.keyPrefix = config.redis.keyPrefix;

    // Set up event listeners
    this.redis.on("error", (err) => {
      logger.error("Redis connection error:", err);
    });

    this.redis.on("connect", () => {
      logger.info("Redis connected successfully");
    });

    // Connect to Redis
    this.redis
      .connect()
      .catch((err) => logger.error("Redis connect error:", err));
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
