import { injectable, inject } from "tsyringe";
import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../utils/logger";
import { IWorkspaceChannelServiceClient } from "../interfaces/external/IWorkspaceChannelServiceClient";
import { ICacheService } from "../interfaces/services/ICacheService";
import {
  ChannelMember,
  WorkspaceChannelServiceResponse,
  WorkspaceChannelServiceErrorResponse,
} from "../types";
import { config } from "../config/env";
import { MessageServiceError } from "../utils/errors";

/**
 * External service client for workspace-channel-service
 * Handles channel membership checks with caching via CacheService
 */
@injectable()
export class WorkspaceChannelServiceClient implements IWorkspaceChannelServiceClient {
  private readonly httpClient: AxiosInstance;
  private readonly cache: ICacheService;
  private readonly baseUrl: string;
  private readonly cacheTtl: number;

  constructor(@inject("ICacheService") cache: ICacheService) {
    this.cache = cache;
    this.baseUrl = config.service.workspaceChannelServiceUrl;
    this.cacheTtl = config.externalServices.cache.channelMembershipTtl;

    // Configure HTTP client with timeout
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.externalServices.timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    logger.info(
      `WorkspaceChannelServiceClient initialized with base URL: ${this.baseUrl}`
    );
  }

  /**
   * Check if a user is a member of a channel with caching
   */
  async getChannelMember(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelMember | null> {
    try {
      // Try cache first
      const cacheKey = this.cache.buildKey(
        "channel",
        "member",
        workspaceId,
        channelId,
        userId
      );
      const cachedMember = await this.cache.get<ChannelMember>(cacheKey);

      if (cachedMember) {
        logger.info(
          `Cache hit for channel member: ${workspaceId}/${channelId}/${userId}`
        );
        return cachedMember;
      }

      logger.info(
        `Cache miss for channel member: ${workspaceId}/${channelId}/${userId}, fetching from service`
      );

      // Fetch from service with retry logic
      const member = await this.fetchChannelMemberWithRetry(
        workspaceId,
        channelId,
        userId
      );

      // Cache the result only if member is found
      if (member) {
        await this.cache.set(cacheKey, member, this.cacheTtl);
      }

      return member;
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.externalService(
        "workspace-channel-service",
        "Failed to check channel membership",
        { workspaceId, channelId, userId }
      );
    }
  }

  /**
   * Fetch channel member from service with retry logic
   */
  private async fetchChannelMemberWithRetry(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelMember | null> {
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
          WorkspaceChannelServiceResponse<ChannelMember>
        >(
          `/api/ws-ch/workspaces/${workspaceId}/channels/${channelId}/members/${userId}`
        );

        // 200 status means success - extract the member data
        if (
          response.status === 200 &&
          response.data.success &&
          response.data.data
        ) {
          return response.data.data;
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
              `Channel member not found or client error (${status}): ${workspaceId}/${channelId}/${userId}`
            );
            return null;
          }

          // 5xx status codes: Server error - retry
          if (status && status >= 500) {
            logger.error(
              `Workspace-channel service server error (${status}) - attempt ${
                attempt + 1
              }:`,
              {
                status,
                message: axiosError.message,
                workspaceId,
                channelId,
                userId,
              }
            );
            continue; // Retry on server errors
          }

          // Other HTTP errors (network, timeout, etc.) - retry
          logger.error(
            `Workspace-channel service request failed (attempt ${
              attempt + 1
            }):`,
            {
              status,
              message: axiosError.message,
              workspaceId,
              channelId,
              userId,
            }
          );
        } else {
          logger.error(`Non-HTTP error fetching channel member:`, error);
        }
      }
    }

    // All attempts failed
    throw MessageServiceError.externalService(
      "workspace-channel-service",
      "Service unavailable after retries",
      {
        workspaceId,
        channelId,
        userId,
        attempts: config.externalServices.maxRetries + 1,
        lastError: lastError?.message || "Unknown error",
      }
    );
  }

  /**
   * Utility method to add delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
