import { injectable } from "tsyringe";
import { RedisClientType } from "redis";
import { config } from "../config/env";
import logger from "../utils/logger";
import { createRedisClient } from "../utils/redisClientFactory";
import { IRedisService } from "../interfaces/services/IRedisService";

/**
 * Redis Cache Service - Manages caching operations with automatic key prefixing
 * Single Responsibility: Cache operations only
 *
 * For Socket.IO pub/sub clients, use the createRedisClient factory directly
 */
@injectable()
export class RedisService implements IRedisService {
  private readonly redisClient: RedisClientType;

  constructor() {
    logger.info("Initializing Redis Cache Service...");

    // Create cache client using factory
    this.redisClient = createRedisClient("Redis Cache Client", true);
  }

  /**
   * Get Redis client instance (for advanced operations)
   */
  getClient(): RedisClientType {
    return this.redisClient;
  }

  /**
   * Close Redis connection (for graceful shutdown)
   */
  async closeConnection(): Promise<void> {
    logger.info("Closing Redis cache connection...");

    if (this.redisClient?.isOpen) {
      await this.redisClient.quit();
    }

    logger.info("✅ Redis cache connection closed");
  }

  /**
   * Helper: Get value with key prefix
   */
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(`${config.redis.keyPrefix}${key}`);
  }

  /**
   * Helper: Set value with key prefix
   */
  async set(
    key: string,
    value: string,
    expirationSeconds?: number
  ): Promise<void> {
    const fullKey = `${config.redis.keyPrefix}${key}`;

    if (expirationSeconds) {
      await this.redisClient.setEx(fullKey, expirationSeconds, value);
    } else {
      await this.redisClient.set(fullKey, value);
    }
  }

  /**
   * Helper: Delete key with prefix
   */
  async del(key: string): Promise<void> {
    await this.redisClient.del(`${config.redis.keyPrefix}${key}`);
  }

  /**
   * Helper: Check if key exists with prefix
   */
  async exists(key: string): Promise<boolean> {
    const exists = await this.redisClient.exists(
      `${config.redis.keyPrefix}${key}`
    );
    return exists === 1;
  }

  /**
   * Helper: Set hash field with prefix
   */
  async hSet(key: string, field: string, value: string): Promise<void> {
    const fullKey = `${config.redis.keyPrefix}${key}`;
    await this.redisClient.hSet(fullKey, field, value);
  }

  /**
   * Helper: Get hash field with prefix
   */
  async hGet(key: string, field: string): Promise<string | undefined> {
    const fullKey = `${config.redis.keyPrefix}${key}`;
    const result = await this.redisClient.hGet(fullKey, field);
    return result ?? undefined;
  }

  /**
   * Helper: Get all hash fields with prefix
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    const fullKey = `${config.redis.keyPrefix}${key}`;
    return this.redisClient.hGetAll(fullKey);
  }

  /**
   * Helper: Delete hash field with prefix
   */
  async hDel(key: string, field: string): Promise<number> {
    const fullKey = `${config.redis.keyPrefix}${key}`;
    return this.redisClient.hDel(fullKey, field);
  }

  /**
   * Helper: Set expiration on a key with prefix
   */
  async expire(key: string, seconds: number): Promise<number> {
    const fullKey = `${config.redis.keyPrefix}${key}`;
    return this.redisClient.expire(fullKey, seconds);
  }
}
