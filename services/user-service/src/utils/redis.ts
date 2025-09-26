import { createClient } from "redis";
import { config } from "../config/env";

/**
 * Redis service for managing refresh tokens
 *
 * Provides secure storage and retrieval of JWT refresh tokens with automatic expiry.
 *
 * Security Features:
 * - Password authentication required for all environments
 * - Secure connections in production (rediss://)
 * - Automatic connection management
 * - Token expiry handling
 *
 * @example
 * ```typescript
 * import { redisService } from './redis';
 *
 * // Store a refresh token
 * await redisService.storeRefreshToken('user123', 'token_value');
 *
 * // Retrieve a refresh token
 * const token = await redisService.getRefreshToken('user123');
 *
 * // Remove a refresh token
 * await redisService.removeRefreshToken('user123');
 * ```
 */
class RedisService {
  private client = createClient({
    url: config.redis.url,
    password: config.redis.password,
  });
  private connected = false;

  /**
   * Establishes connection to Redis server
   *
   * Ensures connection is established only once by checking the connected state.
   * Automatically called by other methods that require Redis connectivity.
   *
   * @throws {Error} When Redis connection fails
   *
   * @example
   * ```typescript
   * await redisService.connect();
   * ```
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  /**
   * Closes connection to Redis server
   *
   * Gracefully disconnects from Redis and updates the connection state.
   * Should be called when the application shuts down to clean up resources.
   *
   * @throws {Error} When Redis disconnection fails
   *
   * @example
   * ```typescript
   * await redisService.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Stores refresh token for a user with automatic expiry
   *
   * Saves the refresh token in Redis with a TTL based on the configured
   * refresh token expiry time. The token will be automatically removed
   * when it expires.
   *
   * @param userId - Unique identifier for the user
   * @param token - JWT refresh token to store
   *
   * @throws {Error} When Redis operation fails or connection cannot be established
   *
   * @example
   * ```typescript
   * await redisService.storeRefreshToken('user123', 'jwt_refresh_token');
   * ```
   */
  async storeRefreshToken(userId: string, token: string): Promise<void> {
    await this.connect();
    const key = this.createUserTokenKey(userId);
    await this.client.setEx(key, config.jwt.refreshTokenExpirySeconds, token);
  }

  /**
   * Retrieves refresh token for a user
   *
   * Fetches the stored refresh token from Redis. Returns null if
   * the token doesn't exist or has expired.
   *
   * @param userId - Unique identifier for the user
   * @returns The refresh token if found, null otherwise
   *
   * @throws {Error} When Redis operation fails or connection cannot be established
   *
   * @example
   * ```typescript
   * const token = await redisService.getRefreshToken('user123');
   * if (token) {
   *   // Token exists and is valid
   *   console.log('Found token:', token);
   * }
   * ```
   */
  async getRefreshToken(userId: string): Promise<string | null> {
    await this.connect();
    const key = this.createUserTokenKey(userId);
    return await this.client.get(key);
  }

  /**
   * Removes refresh token for a user
   *
   * Deletes the stored refresh token from Redis, effectively logging
   * the user out from the current session.
   *
   * @param userId - Unique identifier for the user
   *
   * @throws {Error} When Redis operation fails or connection cannot be established
   *
   * @example
   * ```typescript
   * // Log out user by removing their refresh token
   * await redisService.removeRefreshToken('user123');
   * ```
   */
  async removeRefreshToken(userId: string): Promise<void> {
    await this.connect();
    const key = this.createUserTokenKey(userId);
    await this.client.del(key);
  }

  /**
   * Generates Redis key for user refresh token
   *
   * Creates a standardized key format for storing user refresh tokens
   * in Redis. Uses a consistent naming pattern for easy identification.
   *
   * @param userId - Unique identifier for the user
   * @returns Formatted Redis key string
   *
   * @example
   * ```typescript
   * // Returns: "refresh_token:user123"
   * const key = this.getUserTokenKey('user123');
   * ```
   */
  private createUserTokenKey(userId: string): string {
    return `refresh_token:${userId}`;
  }

  /**
   * Removes all refresh tokens for a user (logout from all devices)
   *
   * Deletes all refresh tokens associated with a user, effectively
   * logging them out from all devices and sessions.
   *
   * @param userId - Unique identifier for the user
   *
   * @throws {Error} When Redis operation fails or connection cannot be established
   *
   * @example
   * ```typescript
   * // Log out user from all devices
   * await redisService.removeAllRefreshTokens('user123');
   * ```
   */
  async removeAllRefreshTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}*`;
    await this.removeTokensByPattern(pattern);
  }

  /**
   * Clears all refresh tokens (for testing only)
   *
   * Removes all refresh tokens from Redis. This method should only
   * be used in test environments for cleanup purposes.
   *
   * @throws {Error} When Redis operation fails or connection cannot be established
   *
   * @example
   * ```typescript
   * // Clear all tokens in test environment
   * await redisService.clearAllRefreshTokens();
   * ```
   */
  async clearAllRefreshTokens(): Promise<void> {
    const pattern = "refresh_token:*";
    await this.removeTokensByPattern(pattern);
  }

  /**
   * Removes tokens matching a Redis pattern
   *
   * Uses Redis KEYS command to find all keys matching the given pattern
   * and deletes them in a batch operation. Used internally by other
   * cleanup methods.
   *
   * @param pattern - Redis key pattern to match (supports wildcards)
   *
   * @throws {Error} When Redis operation fails or connection cannot be established
   *
   * @example
   * ```typescript
   * // Remove all tokens for a specific user
   * await this.removeTokensByPattern('refresh_token:user123*');
   *
   * // Remove all refresh tokens
   * await this.removeTokensByPattern('refresh_token:*');
   * ```
   */
  private async removeTokensByPattern(pattern: string): Promise<void> {
    await this.connect();
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

export const redisService = new RedisService();
