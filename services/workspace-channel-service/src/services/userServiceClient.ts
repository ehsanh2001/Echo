import { inject, injectable } from "tsyringe";
import { createHttpClient } from "@echo/http-client";
import { config } from "../config/env";
import { UserInfo, EnrichedUserInfo } from "../types";
import logger from "../utils/logger";
import { WorkspaceChannelServiceError } from "../utils/errors";
import { CacheService } from "./CacheService";

/**
 * Client for communicating with user-service
 */
@injectable()
export class UserServiceClient {
  private readonly httpClient;
  private readonly baseUrl: string;

  constructor(@inject("CacheService") private cacheService: CacheService) {
    this.baseUrl = config.service.userServiceUrl;
    this.httpClient = createHttpClient({
      serviceName: "workspace-channel-service",
      timeout: 5000,
      maxRetries: 2,
      debugLogging: config.nodeEnv === "development",
    });
  }

  /**
   * Check if user exists and is active by user ID
   * Returns user info if exists, throws error if not found
   * If user-service is down, considers user as valid (resilient approach)
   */
  async checkUserExistsById(userId: string): Promise<UserInfo | null> {
    try {
      logger.info(`🔍 Checking user existence by ID: ${userId}`);

      const response = await this.httpClient.get<{
        success: boolean;
        data: UserInfo;
      }>(`${this.baseUrl}/api/users/${userId}`);

      const userInfo = response.data.data;

      // Note: user-service endpoints already filter for active users,
      // so if we get a response, the user is guaranteed to be active
      logger.info(`✅ User exists and is active: ${userInfo.email}`);
      return userInfo;
    } catch (error) {
      return this.handleUserServiceError(error, "checkUserExistsById", userId);
    }
  }

  /**
   * Check if user exists and is active by email
   * Returns user info if exists, returns null if not found
   * If user-service is down, considers user as valid (resilient approach)
   */
  async checkUserExistsByEmail(email: string): Promise<UserInfo | null> {
    try {
      logger.info(`🔍 Checking user existence by email: ${email}`);

      const response = await this.httpClient.get<{
        success: boolean;
        data: UserInfo;
      }>(
        `${this.baseUrl}/api/users/searchbyemail/${encodeURIComponent(email)}`
      );

      logger.info(`✅ User found by email: ${response.data.data.username}`);
      return response.data.data;
    } catch (error) {
      return this.handleUserServiceError(
        error,
        "checkUserExistsByEmail",
        email
      );
    }
  }

  /**
   * Get multiple users by their IDs with caching
   *
   * First checks cache for each user, then fetches missing users from user-service in batch.
   * Updates cache with newly fetched users.
   *
   * @param userIds - Array of user IDs to fetch
   * @returns Map of userId -> enriched user info
   */
  async getUsersByIds(
    userIds: string[]
  ): Promise<Map<string, EnrichedUserInfo>> {
    const result = new Map<string, EnrichedUserInfo>();

    if (userIds.length === 0) {
      return result;
    }

    // Declare cachedUsers outside try block so it's accessible in catch
    let cachedUsers = new Map<string, EnrichedUserInfo>();

    try {
      // 1. Check cache for all users
      logger.debug("Checking cache for users", { count: userIds.length });
      cachedUsers = await this.cacheService.getCachedUsers(userIds);

      // 2. Identify users not in cache
      const uncachedUserIds = userIds.filter((id) => !cachedUsers.has(id));

      // 3. Fetch missing users from user-service
      if (uncachedUserIds.length > 0) {
        logger.info(
          `Fetching ${uncachedUserIds.length} users from user-service`
        );

        const response = await this.httpClient.post<{
          success: boolean;
          data: UserInfo[];
        }>(`${this.baseUrl}/api/users/batch`, { userIds: uncachedUserIds });

        const fetchedUsers = response.data.data;

        // Convert UserInfo to EnrichedUserInfo and cache
        const enrichedUsers: EnrichedUserInfo[] = fetchedUsers.map(
          (user: UserInfo) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            lastSeen: user.lastSeen,
          })
        );

        // Cache newly fetched users
        if (enrichedUsers.length > 0) {
          await this.cacheService.setCachedUsers(enrichedUsers);
        }

        // Add to result map
        enrichedUsers.forEach((user) => {
          result.set(user.id, user);
        });

        logger.info(`Fetched and cached ${fetchedUsers.length} users`);
      }

      // 4. Add cached users to result
      cachedUsers.forEach((user, userId) => {
        result.set(userId, user);
      });

      logger.info(
        `Returning ${result.size} users (${cachedUsers.size} from cache, ${result.size - cachedUsers.size} from service)`
      );
      return result;
    } catch (error) {
      logger.error("Error fetching users by IDs", { error });

      // Resilient approach - return whatever we got from cache
      if (cachedUsers.size > 0) {
        logger.warn(
          `User-service unavailable, returning ${cachedUsers.size} cached users`
        );
        return cachedUsers;
      }

      throw WorkspaceChannelServiceError.externalService(
        "Failed to fetch user data from user-service"
      );
    }
  }

  /**
   * Centralized error handling for user-service requests
   * Provides consistent behavior across all methods
   */
  private handleUserServiceError(
    error: unknown,
    operation: string,
    identifier: string
  ): UserInfo | null {
    // Re-throw our own service errors
    if (error instanceof WorkspaceChannelServiceError) {
      throw error;
    }

    // http-client wraps errors with status codes
    const httpError = error as any;

    if (httpError.status) {
      // User not found (404) - user-service returns this for non-existent users
      if (httpError.status === 404) {
        throw WorkspaceChannelServiceError.notFound("User", identifier);
      }

      // Bad request (400) - user-service returns this for validation errors
      if (httpError.status === 400) {
        throw WorkspaceChannelServiceError.badRequest(
          `Invalid request to user-service: ${httpError.message || "Bad Request"}`
        );
      }

      // Other 4xx client errors
      if (httpError.status >= 400 && httpError.status < 500) {
        throw WorkspaceChannelServiceError.badRequest(
          `User service client error: ${httpError.message || "Client Error"}`
        );
      }

      // 5xx server errors from user-service
      if (httpError.status >= 500) {
        logger.warn(
          `⚠️  User-service server error (${httpError.status}), considering user ${identifier} as valid`
        );
        return null;
      }
    }

    // Service is down or unreachable - resilient approach
    // http-client already logs errors, so we just handle gracefully
    logger.warn(
      `⚠️  User-service unavailable for ${operation}, considering user ${identifier} as valid`
    );
    return null;
  }
}
