import axios, { AxiosError } from "axios";
import { config } from "../config/env";
import { UserInfo } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Client for communicating with user-service
 */
export class UserServiceClient {
  private readonly baseUrl: string;
  private readonly timeout: number = 5000; // 5 seconds timeout

  constructor() {
    this.baseUrl = config.service.userServiceUrl;
  }

  /**
   * Check if user exists and is active by user ID
   * Returns user info if exists, throws error if not found
   * If user-service is down, considers user as valid (resilient approach)
   */
  async checkUserExistsById(userId: string): Promise<UserInfo | null> {
    try {
      console.log(`🔍 Checking user existence by ID: ${userId}`);

      const response = await axios.get<UserInfo>(
        `${this.baseUrl}/api/users/${userId}`,
        {
          timeout: this.timeout,
        }
      );

      const userInfo = response.data;

      // Note: user-service endpoints already filter for active users,
      // so if we get a response, the user is guaranteed to be active
      console.log(`✅ User exists and is active: ${userInfo.email}`);
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
      console.log(`🔍 Checking user existence by email: ${email}`);

      const response = await axios.get<UserInfo>(
        `${this.baseUrl}/api/users/searchbyemail/${encodeURIComponent(email)}`,
        {
          timeout: this.timeout,
        }
      );

      console.log(`✅ User found by email: ${response.data.username}`);
      return response.data;
    } catch (error) {
      return this.handleUserServiceError(
        error,
        "checkUserExistsByEmail",
        email
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

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // User not found (404) - user-service returns this for non-existent users
      // Both methods should throw error when user doesn't exist
      if (axiosError.response?.status === 404) {
        throw WorkspaceChannelServiceError.notFound("User", identifier);
      }

      // Bad request (400) - user-service returns this for validation errors
      if (axiosError.response?.status === 400) {
        throw WorkspaceChannelServiceError.badRequest(
          `Invalid request to user-service: ${axiosError.response.statusText}`
        );
      }

      // Other 4xx client errors
      if (
        axiosError.response &&
        axiosError.response.status >= 400 &&
        axiosError.response.status < 500
      ) {
        throw WorkspaceChannelServiceError.badRequest(
          `User service client error: ${axiosError.response.statusText}`
        );
      }

      // 5xx server errors from user-service
      if (axiosError.response && axiosError.response.status >= 500) {
        console.warn(
          `⚠️  User-service server error (${axiosError.response.status}), considering user ${identifier} as valid`
        );
        return null;
      }

      // Service is down or unreachable - resilient approach
      if (
        !axiosError.response ||
        axiosError.code === "ECONNREFUSED" ||
        axiosError.code === "ETIMEDOUT"
      ) {
        console.warn(
          `⚠️  User-service unavailable for ${operation}, considering user ${identifier} as valid`
        );
        return null;
      }
    }

    // Network or other unexpected errors - resilient approach
    console.warn(
      `⚠️  Unexpected error in ${operation}, considering user ${identifier} as valid:`,
      error
    );
    return null;
  }
}
