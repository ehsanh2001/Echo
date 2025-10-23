import { injectable, inject } from "tsyringe";
import { IMessageService } from "../interfaces/services/IMessageService";
import {
  IRabbitMQService,
  MessageCreatedEvent,
} from "../interfaces/services/IRabbitMQService";
import { IMessageRepository } from "../interfaces/repositories/IMessageRepository";
import { IUserServiceClient } from "../interfaces/external/IUserServiceClient";
import { IWorkspaceChannelServiceClient } from "../interfaces/external/IWorkspaceChannelServiceClient";
import { MessageWithAuthorResponse, AuthorInfo } from "../types";
import { config } from "../config/env";
import { MessageServiceError } from "../utils/errors";

/**
 * Message service implementing business logic for message operations
 *
 * Business Flow for sendMessage:
 * 1. Validate content (not empty, within length limits)
 * 2. Verify membership and get author info
 * 3. Create message via repository
 * 4. Create response with author info
 * 5. Publish RabbitMQ event
 * 6. Return formatted response with author info
 */
@injectable()
export class MessageService implements IMessageService {
  constructor(
    @inject("IMessageRepository") private messageRepository: IMessageRepository,
    @inject("IUserServiceClient") private userServiceClient: IUserServiceClient,
    @inject("IWorkspaceChannelServiceClient")
    private workspaceChannelServiceClient: IWorkspaceChannelServiceClient,
    @inject("IRabbitMQService") private rabbitMQService: IRabbitMQService
  ) {}

  /**
   * Send a message to a channel
   */
  async sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    content: string
  ): Promise<MessageWithAuthorResponse> {
    // Step 1: Validate content
    this.validateContent(content);

    // Step 2: Verify membership and get author info concurrently
    const [, authorInfo] = await Promise.all([
      this.verifyChannelMembership(workspaceId, channelId, userId),
      this.getAuthorInfo(userId),
    ]);

    // Step 3: Create message via repository
    const message = await this.messageRepository.create({
      workspaceId,
      channelId,
      userId,
      content,
      contentType: "text", // Only plain text for now
    });

    // Step 4: Create response with author info
    const messageWithAuthor: MessageWithAuthorResponse = {
      ...message,
      author: authorInfo,
    };

    // Step 5: Publish RabbitMQ event (async, don't wait)
    this.publishMessageEvent(messageWithAuthor).catch((error) => {
      console.error("Failed to publish message event:", error);
      // Don't throw - message creation succeeded
    });

    // Step 6: Return formatted response
    return messageWithAuthor;
  }

  /**
   * Validate message content
   */
  private validateContent(content: string): void {
    // Check for empty content
    if (!content || content.trim().length === 0) {
      throw MessageServiceError.emptyMessage();
    }

    // Check for content length
    if (content.length > config.message.maxLength) {
      throw MessageServiceError.messageTooLong(
        config.message.maxLength,
        content.length
      );
    }
  }

  /**
   * Verify user is a member of the channel
   */
  private async verifyChannelMembership(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      // Check if user is member of channel
      const member = await this.workspaceChannelServiceClient.getChannelMember(
        workspaceId,
        channelId,
        userId
      );

      if (!member) {
        throw MessageServiceError.notChannelMember(channelId, userId);
      }

      // Additional checks could be added here:
      // - Channel archived status
      // - Channel read-only status
      // - User muted status
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // External service error
      throw MessageServiceError.externalService(
        "workspace-channel-service",
        "Failed to verify channel membership",
        { workspaceId, channelId, userId }
      );
    }
  }

  /**
   * Get author information for the response
   */
  private async getAuthorInfo(userId: string): Promise<AuthorInfo> {
    try {
      const userProfile = await this.userServiceClient.getUserProfile(userId);

      if (!userProfile) {
        throw MessageServiceError.notFound("User", userId);
      }

      return {
        id: userProfile.id,
        username: userProfile.username,
        displayName: userProfile.displayName,
        avatarUrl: userProfile.avatarUrl,
      };
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // External service error
      throw MessageServiceError.externalService(
        "user-service",
        "Failed to get user profile",
        { userId }
      );
    }
  }

  /**
   * Publish message created event to RabbitMQ
   */
  private async publishMessageEvent(
    messageWithAuthor: MessageWithAuthorResponse
  ): Promise<void> {
    const event: MessageCreatedEvent = {
      type: "message.created",
      payload: messageWithAuthor,
      timestamp: new Date().toISOString(),
    };

    await this.rabbitMQService.publishMessageEvent(event);
  }
}
