import { injectable, inject } from "tsyringe";
import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../utils/logger";
import { IUserServiceClient } from "../interfaces/external/IUserServiceClient";
import { ICacheService } from "../interfaces/services/ICacheService";
import { UserProfile, UserServiceResponse } from "../types";
import { config } from "../config/env";
import { MessageServiceError } from "../utils/errors";

/**
 * External service client for user-service
 * Handles user profile lookups with caching via CacheService
 */
@injectable()
export class UserServiceClient implements IUserServiceClient {
  private readonly httpClient: AxiosInstance;
  private readonly cache: ICacheService;
  private readonly baseUrl: string;
  private readonly cacheTtl: number;

  constructor(@inject("ICacheService") cache: ICacheService) {
    this.cache = cache;
    this.baseUrl = config.service.userServiceUrl;
    this.cacheTtl = config.externalServices.cache.userProfileTtl;

    // Configure HTTP client with timeout
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.externalServices.timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    logger.info(`UserServiceClient initialized with baseUrl: ${this.baseUrl}`);
  }

  /**
   * Get a user profile by user ID with caching
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Try cache first
      const cacheKey = this.cache.buildKey("user", "profile", userId);
      const cachedProfile = await this.cache.get<UserProfile>(cacheKey);

      if (cachedProfile) {
        logger.info(`Cache hit for user profile: ${userId}`);
        return cachedProfile;
      }

      logger.info(
        `Cache miss for user profile: ${userId}, fetching from service`
      );

      // Fetch from service with retry logic
      const profile = await this.fetchUserProfileWithRetry(userId);

      // Cache the result if found
      if (profile) {
        await this.cache.set(cacheKey, profile, this.cacheTtl);
      }

      return profile;
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.externalService(
        "user-service",
        "Failed to retrieve user profile",
        { userId }
      );
    }
  }

  /**
   * Fetch user profile from service with retry logic
   */
  private async fetchUserProfileWithRetry(
    userId: string
  ): Promise<UserProfile | null> {
    let lastError: Error | null = null;

    // Initial attempt + retry
    for (
      let attempt = 0;
      attempt < config.externalServices.maxRetries + 1;
      attempt++
    ) {
      try {
        if (attempt > 0) {
          await this.delay(config.externalServices.retryDelay);
        }

        const response = await this.httpClient.get<
          UserServiceResponse<UserProfile>
        >(`/api/users/${userId}`);

        // 200 status means success - extract the user data
        if (
          response.status === 200 &&
          response.data.success &&
          response.data.data
        ) {
          const profile = response.data.data;
          return profile;
        }

        // 200 but no data - should not happen with proper API, treat as error
        throw new Error(
          `Unexpected API response: status ${
            response.status
          }, data: ${JSON.stringify(response.data)}`
        );
      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          const status = axiosError.response?.status;

          // 4xx status codes: User not found or client error - don't retry
          if (status && status >= 400 && status < 500) {
            logger.info(
              `User not found or client error (${status}): ${userId}`
            );
            return null;
          }

          // 5xx status codes: Server error - retry
          if (status && status >= 500) {
            logger.error(
              `User service server error (${status}) - attempt ${attempt + 1}:`,
              {
                status,
                message: axiosError.message,
                userId,
              }
            );
            continue; // Retry on server errors
          }

          // Other HTTP errors (network, timeout, etc.) - retry
          logger.error(
            `User service request failed (attempt ${attempt + 1}):`,
            {
              status,
              message: axiosError.message,
              userId,
            }
          );
        } else {
          logger.error(`Non-HTTP error fetching user profile:`, error);
        }
      }
    }

    // All attempts failed
    throw MessageServiceError.externalService(
      "user-service",
      "Service unavailable after retries",
      {
        userId,
        attempts: config.externalServices.maxRetries + 1,
        lastError: lastError?.message || "Unknown error",
      }
    );
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
