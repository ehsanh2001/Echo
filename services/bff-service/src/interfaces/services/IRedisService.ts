import { RedisClientType } from "redis";

/**
 * Interface for Redis Cache Service
 * Focused solely on caching operations with automatic key prefixing
 */
export interface IRedisService {
  /**
   * Get Redis client instance (for advanced operations)
   * @returns Redis client
   */
  getClient(): RedisClientType;

  /**
   * Close Redis connection (for graceful shutdown)
   */
  closeConnection(): Promise<void>;

  /**
   * Get a value from Redis with automatic key prefixing
   * @param key - The cache key (prefix will be added automatically)
   * @returns Promise resolving to value or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in Redis with automatic key prefixing
   * @param key - The cache key (prefix will be added automatically)
   * @param value - The value to store
   * @param expirationSeconds - Optional expiration time in seconds
   */
  set(key: string, value: string, expirationSeconds?: number): Promise<void>;

  /**
   * Delete a key from Redis with automatic key prefixing
   * @param key - The cache key (prefix will be added automatically)
   */
  del(key: string): Promise<void>;

  /**
   * Check if a key exists in Redis with automatic key prefixing
   * @param key - The cache key (prefix will be added automatically)
   * @returns Promise resolving to true if key exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Set a hash field in Redis with automatic key prefixing
   * @param key - The hash key (prefix will be added automatically)
   * @param field - The hash field name
   * @param value - The field value
   */
  hSet(key: string, field: string, value: string): Promise<void>;

  /**
   * Get a hash field from Redis with automatic key prefixing
   * @param key - The hash key (prefix will be added automatically)
   * @param field - The hash field name
   * @returns Promise resolving to field value or undefined if not found
   */
  hGet(key: string, field: string): Promise<string | undefined>;

  /**
   * Get all hash fields from Redis with automatic key prefixing
   * @param key - The hash key (prefix will be added automatically)
   * @returns Promise resolving to object with all hash fields
   */
  hGetAll(key: string): Promise<Record<string, string>>;

  /**
   * Delete a hash field from Redis with automatic key prefixing
   * @param key - The hash key (prefix will be added automatically)
   * @param field - The hash field name
   * @returns Promise resolving to number of fields deleted
   */
  hDel(key: string, field: string): Promise<number>;

  /**
   * Set expiration on a key in Redis with automatic key prefixing
   * @param key - The cache key (prefix will be added automatically)
   * @param seconds - Expiration time in seconds
   * @returns Promise resolving to true if expiration was set, false otherwise
   */
  expire(key: string, seconds: number): Promise<number>;
}
