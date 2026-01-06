/**
 * Interface for cache service operations
 * Provides a centralized abstraction for Redis caching across the application
 */
export interface ICacheService {
  /**
   * Get a value from cache
   * @param key - The cache key
   * @returns Promise resolving to cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache with TTL
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttlSeconds - Time to live in seconds
   * @returns Promise resolving when cache operation completes
   */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Delete a value from cache
   * @param key - The cache key
   * @returns Promise resolving to true if key existed, false otherwise
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete all keys matching a pattern
   * Uses Redis SCAN to avoid blocking on large keyspaces
   * @param pattern - The pattern to match (e.g., "prefix:*:suffix")
   * @returns Promise resolving to the number of keys deleted
   */
  deleteByPattern(pattern: string): Promise<number>;

  /**
   * Check if a key exists in cache
   * @param key - The cache key
   * @returns Promise resolving to true if key exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get multiple values from cache
   * @param keys - Array of cache keys
   * @returns Promise resolving to array of values (null for missing keys)
   */
  getMultiple<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple values in cache with same TTL
   * @param entries - Array of key-value pairs
   * @param ttlSeconds - Time to live in seconds
   * @returns Promise resolving when cache operations complete
   */
  setMultiple<T>(
    entries: Array<{ key: string; value: T }>,
    ttlSeconds: number
  ): Promise<void>;

  /**
   * Generate cache key with service prefix
   * @param parts - Key parts to join
   * @returns Formatted cache key with service prefix
   */
  buildKey(...parts: string[]): string;
}
