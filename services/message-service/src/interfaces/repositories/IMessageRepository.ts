import { CreateMessageData, MessageResponse } from "../../types";

/**
 * Interface for message repository operations
 *
 * Handles data access layer for messages in PostgreSQL
 */
export interface IMessageRepository {
  /**
   * Create a new message in a channel
   *
   * @param data - Message data to create (messageNo generated internally)
   * @returns Created message with all fields including generated messageNo
   * @throws MessageServiceError if creation fails
   *
   * @example
   * ```typescript
   * const message = await messageRepository.create({
   *   workspaceId: 'workspace-uuid',
   *   channelId: 'channel-uuid',
   *   userId: 'user-uuid',
   *   content: 'Hello team!'
   * });
   * ```
   */
  create(data: CreateMessageData): Promise<MessageResponse>;
}
