import bcrypt from "bcryptjs";
import { injectable, inject } from "tsyringe";
import { config } from "../config/env";
import { User, UserProfile } from "../types/user.types";
import {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from "../types/auth.types";
import { JwtPayload } from "../types/jwt.types";
import { UserServiceError } from "../types/error.types";
import { JWTService } from "../utils/jwt";
import { redisService } from "../utils/redis";
import { IAuthService } from "../interfaces/services/IAuthService";
import { IUserRepository } from "../interfaces/repositories/IUserRepository";

/**
 * Authentication service for user login, logout, and token management
 *
 * Provides secure authentication functionality including password verification,
 * JWT token generation/validation, and session management for refresh tokens via Redis.
 *
 * Features:
 * - Password-based authentication with bcrypt verification
 * - JWT-based access and refresh token management
 * - Redis-backed session storage with automatic expiry
 * - Secure logout with token invalidation
 * - Dependency injection for testability and modularity
 */
@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject("IUserRepository") private userRepository: IUserRepository
  ) {}
  /**
   * Authenticates a user and returns JWT tokens
   *
   * Validates user credentials, generates access and refresh tokens,
   * stores refresh token in Redis, and updates user's last seen timestamp.
   *
   * @param data - Login credentials (email/username and password)
   * @returns Promise resolving to login response with tokens and user profile
   *
   * @throws {UserServiceError} When user is not found (USER_NOT_FOUND)
   * @throws {UserServiceError} When password is invalid (INVALID_CREDENTIALS)
   * @throws {UserServiceError} When login process fails (LOGIN_FAILED)
   *
   * @example
   * ```typescript
   * const response = await authService.loginUser({
   *   identifier: 'john@example.com',
   *   password: 'securePassword123'
   * });
   * // Returns: { access_token, refresh_token, expires_in, user }
   * ```
   */
  async loginUser(data: LoginRequest): Promise<LoginResponse> {
    try {
      const user = await this.findAndValidateUser(data);
      await this.verifyPassword(data.password, user.passwordHash!);

      const { access_token, refresh_token, expires_in } =
        await this.generateAndStoreTokens(user);

      await this.updateLastSeen(user.id);

      console.log(`User logged in: ${user.email} (${user.id})`);

      return {
        access_token,
        refresh_token,
        expires_in,
        user: this.formatUserProfile(user),
      };
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      console.error("Login error:", error);
      throw new UserServiceError("Login failed", "LOGIN_FAILED", 500);
    }
  }

  /**
   * Refreshes JWT tokens using a valid refresh token
   *
   * Validates the refresh token, generates new access and refresh tokens,
   * and stores the new refresh token in Redis.
   *
   * @param refreshToken - Valid refresh token from previous login/refresh
   * @returns Promise resolving to new tokens
   *
   * @throws {UserServiceError} When refresh token is invalid (INVALID_REFRESH_TOKEN)
   * @throws {UserServiceError} When user is not found (USER_NOT_FOUND)
   * @throws {UserServiceError} When refresh process fails (REFRESH_FAILED)
   *
   * @example
   * ```typescript
   * const newTokens = await authService.refreshToken('old.refresh.token');
   * // Returns: { access_token, refresh_token, expires_in }
   * ```
   */
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    try {
      // Verify refresh token with type validation
      const payload = JWTService.verifyToken(
        refreshToken,
        "refresh"
      ) as JwtPayload;
      const { userId } = payload;

      await this.validateRefreshToken(userId, refreshToken);

      const user = await this.findActiveUser(userId);
      const { access_token, refresh_token, expires_in } =
        await this.generateAndStoreTokens(user);

      return {
        access_token,
        refresh_token,
        expires_in,
      };
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      console.error("Token refresh error:", error);
      throw new UserServiceError("Token refresh failed", "REFRESH_FAILED", 500);
    }
  }

  /**
   * Logs out user by invalidating refresh token
   *
   * Removes the user's refresh token from Redis storage, effectively
   * invalidating their session. Access tokens remain valid until natural expiry
   * for better performance.
   *
   * @param userId - Unique identifier of the user
   *
   * @throws {UserServiceError} When logout process fails (LOGOUT_FAILED)
   * @throws {Error} When Redis operation fails
   *
   * @example
   * ```typescript
   * await authService.logoutUser('user123');
   * console.log('User logged out successfully');
   * ```
   */
  async logoutUser(userId: string): Promise<void> {
    try {
      // Remove refresh token from Redis
      await redisService.removeRefreshToken(userId);

      console.log(`User logged out: ${userId}`);
    } catch (error) {
      console.error("Logout error:", error);
      throw new UserServiceError("Logout failed", "LOGOUT_FAILED", 500);
    }
  }

  /**
   * Finds and validates user credentials
   *
   * Searches for user by email or username and validates that the user
   * exists and has a password hash (not OAuth-only account).
   *
   * @param data - Login credentials
   * @returns Promise resolving to user entity
   *
   * @throws {UserServiceError} When user is not found (USER_NOT_FOUND)
   * @throws {UserServiceError} When user has no password (INVALID_CREDENTIALS)
   *
   * @example
   * ```typescript
   * const user = await this.findAndValidateUser({
   *   identifier: 'john@example.com',
   *   password: 'password123'
   * });
   * ```
   */
  private async findAndValidateUser(data: LoginRequest): Promise<User> {
    const user = await this.userRepository.findByEmailOrUsername(
      data.identifier,
      data.identifier
    );

    if (!user || !user.passwordHash || !user.isActive || user.deletedAt) {
      throw new UserServiceError(
        "Invalid credentials",
        "INVALID_CREDENTIALS",
        401
      );
    }

    return user;
  }

  /**
   * Verifies password against stored hash
   *
   * Uses bcrypt to compare the provided password with the stored hash.
   *
   * @param password - Plain text password from login request
   * @param passwordHash - Stored bcrypt hash from database
   *
   * @throws {UserServiceError} When password doesn't match (INVALID_CREDENTIALS)
   *
   * @example
   * ```typescript
   * await this.verifyPassword('userPassword123', user.passwordHash);
   * ```
   */
  private async verifyPassword(
    password: string,
    passwordHash: string
  ): Promise<void> {
    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      throw new UserServiceError(
        "Invalid credentials",
        "INVALID_CREDENTIALS",
        401
      );
    }
  }

  /**
   * Generates JWT token pair and stores refresh token
   *
   * Creates both access and refresh tokens, stores the refresh token
   * in Redis with automatic expiration.
   *
   * @param user - User entity for token generation
   * @returns Promise resolving to token pair with expiration info
   *
   * @example
   * ```typescript
   * const tokens = await this.generateAndStoreTokens(user);
   * // Returns: { access_token, refresh_token, expires_in }
   * ```
   */
  private async generateAndStoreTokens(user: User): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const baseTokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
    };

    const { accessToken, refreshToken } =
      JWTService.generateTokenPair(baseTokenPayload);

    // Store refresh token in Redis
    await redisService.storeRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: config.jwt.accessTokenExpirySeconds,
    };
  }

  /**
   * Updates user's last seen timestamp
   *
   * Records the current timestamp as the user's last activity time.
   * This is called during successful login operations.
   *
   * @param userId - Unique identifier of the user
   *
   * @example
   * ```typescript
   * await this.updateLastSeen('user123');
   * ```
   */
  private async updateLastSeen(userId: string): Promise<void> {
    await this.userRepository.updateLastSeen(userId);
  }

  /**
   * Validates refresh token against Redis storage
   *
   * Checks that the provided refresh token matches what's stored
   * in Redis for the given user.
   *
   * @param userId - User ID from JWT payload
   * @param refreshToken - Refresh token to validate
   *
   * @throws {UserServiceError} When token doesn't match (INVALID_REFRESH_TOKEN)
   *
   * @example
   * ```typescript
   * await this.validateRefreshToken('user123', 'refresh.token.here');
   * ```
   */
  private async validateRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<void> {
    const storedToken = await redisService.getRefreshToken(userId);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UserServiceError(
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN",
        401
      );
    }
  }

  /**
   * Finds active user by ID
   *
   * Retrieves user entity ensuring they are not deleted and are active.
   *
   * @param userId - User's unique identifier
   * @returns Promise resolving to user entity
   *
   * @throws {UserServiceError} When user is not found (USER_NOT_FOUND)
   *
   * @example
   * ```typescript
   * const user = await this.findActiveUser('user123');
   * ```
   */
  private async findActiveUser(userId: string): Promise<User> {
    const user = await this.userRepository.findActiveById(userId);

    if (!user) {
      throw new UserServiceError("User not found", "USER_NOT_FOUND", 404);
    }

    return user;
  }

  /**
   * Formats user data for API response
   *
   * Transforms internal user object to public user profile format,
   * excluding sensitive information like password hash.
   *
   * @param user - Internal user object from database
   * @returns Formatted user profile for API responses
   *
   * @example
   * ```typescript
   * const profile = this.formatUserProfile(user);
   * // Returns: { id, email, username, displayName, bio, avatarUrl, createdAt, lastSeen, roles }
   * ```
   */
  private formatUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      roles: user.roles,
    };
  }
}
