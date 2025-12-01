import { injectable } from "tsyringe";
import axios, { AxiosInstance } from "axios";
import { IUserServiceClient } from "../interfaces/services/IUserServiceClient";
import { UserProfile, UserServiceResponse } from "../types/email";
import { config } from "../config/env";
import { logger } from "../config/logger";

/**
 * User service client
 *
 * Features:
 * - Fetch user details from user-service
 * - Fallback to userId if service unavailable
 * - Error handling
 */
@injectable()
export class UserServiceClient implements IUserServiceClient {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.service.userServiceUrl,
      timeout: 5000, // 5 second timeout
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get user by ID from user-service
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      logger.debug("Fetching user from user-service", { userId });

      const response = await this.httpClient.get<
        UserServiceResponse<UserProfile>
      >(`/api/users/${userId}`);

      // Extract user from response wrapper
      const user = response.data.data;

      logger.debug("User fetched successfully", {
        userId,
        displayName: user.displayName,
      });

      return user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.warn("Failed to fetch user from user-service", {
          userId,
          status: error.response?.status,
          message: error.message,
        });
      } else {
        logger.warn("Unexpected error fetching user", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Return null on error - caller should handle fallback
      return null;
    }
  }
}
