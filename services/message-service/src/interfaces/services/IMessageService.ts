import { MessageWithAuthorResponse } from "../../types";

/**
 * Interface for message service business logic
 */
export interface IMessageService {
  /**
   * Send a message to a channel
   * @param workspaceId - The workspace ID where the channel belongs
   * @param channelId - The channel ID where the message should be sent
   * @param userId - The ID of the user sending the message
   * @param content - The message content
   * @returns Promise resolving to the created message with author information
   * @throws MessageServiceError for business logic violations
   */
  sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    content: string
  ): Promise<MessageWithAuthorResponse>;
}
