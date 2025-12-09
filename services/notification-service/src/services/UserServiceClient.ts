import { injectable } from "tsyringe";
import axios from "axios";
import { createHttpClient } from "@echo/http-client";
import { IUserServiceClient } from "../interfaces/services/IUserServiceClient";
import { UserProfile, UserServiceResponse } from "../types/email";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * User service client
 *
 * Features:
 * - Fetch user details from user-service
 * - Automatic correlation ID propagation
 * - Fallback to userId if service unavailable
 * - Error handling and retry logic
 */
@injectable()
export class UserServiceClient implements IUserServiceClient {
  private readonly httpClient;
  private readonly baseURL: string;

  constructor() {
    this.baseURL = config.service.userServiceUrl;
    this.httpClient = createHttpClient({
      serviceName: "notification-service",
      timeout: 5000, // 5 second timeout
      maxRetries: 2,
      debugLogging: config.nodeEnv === "development",
    });
  }

  /**
   * Get user by ID from user-service
   * Correlation ID is automatically propagated via @echo/http-client
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const response = await this.httpClient.get<
        UserServiceResponse<UserProfile>
      >(`${this.baseURL}/api/users/${userId}`);

      // Extract user from response wrapper
      const user = response.data.data;

      return user;
    } catch (error) {
      // http-client already logs errors, just return null for fallback
      return null;
    }
  }
}
