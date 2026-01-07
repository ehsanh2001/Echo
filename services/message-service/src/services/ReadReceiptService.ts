import { injectable, inject } from "tsyringe";
import logger from "../utils/logger";
import { IReadReceiptService } from "../interfaces/services/IReadReceiptService";
import { IReadReceiptRepository } from "../interfaces/repositories/IReadReceiptRepository";
import { IMessageRepository } from "../interfaces/repositories/IMessageRepository";
import {
  ReadReceiptResponse,
  ChannelUnreadInfo,
  WorkspaceUnreadCountsResponse,
} from "../types";
import { MessageServiceError } from "../utils/errors";

/**
 * Read receipt service implementing business logic for read tracking
 *
 * Handles:
 * - Marking messages as read
 * - Calculating unread counts
 * - Coordinating between read receipts and channel sequences
 */
@injectable()
export class ReadReceiptService implements IReadReceiptService {
  constructor(
    @inject("IReadReceiptRepository")
    private readReceiptRepository: IReadReceiptRepository,
    @inject("IMessageRepository")
    private messageRepository: IMessageRepository
  ) {}

  /**
   * Mark messages as read up to a specific message number
   */
  async markAsRead(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageNo: number,
    messageId?: string
  ): Promise<ReadReceiptResponse> {
    logger.info("Marking messages as read", {
      workspaceId,
      channelId,
      userId,
      messageNo,
    });

    // Validate messageNo is positive
    if (messageNo < 0) {
      throw MessageServiceError.validation("messageNo must be non-negative", {
        field: "messageNo",
        value: messageNo,
      });
    }

    // Get current read receipt to check if update is needed
    const currentReceipt = await this.readReceiptRepository.getReadReceipt(
      workspaceId,
      channelId,
      userId
    );

    // Only update if new messageNo is greater than current
    if (currentReceipt && currentReceipt.lastReadMessageNo >= messageNo) {
      logger.debug("Read position already at or ahead of requested position", {
        currentPosition: currentReceipt.lastReadMessageNo,
        requestedPosition: messageNo,
      });
      return currentReceipt;
    }

    // Upsert the read receipt
    const receipt = await this.readReceiptRepository.upsertReadReceipt(
      workspaceId,
      channelId,
      userId,
      messageNo,
      messageId
    );

    logger.info("Messages marked as read", {
      workspaceId,
      channelId,
      userId,
      newPosition: messageNo,
      previousPosition: currentReceipt?.lastReadMessageNo || 0,
    });

    return receipt;
  }

  /**
   * Get the user's read receipt for a channel
   */
  async getReadReceipt(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ReadReceiptResponse | null> {
    return this.readReceiptRepository.getReadReceipt(
      workspaceId,
      channelId,
      userId
    );
  }

  /**
   * Get unread count for a specific channel
   */
  async getUnreadCount(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelUnreadInfo> {
    logger.debug("Getting unread count for channel", {
      workspaceId,
      channelId,
      userId,
    });

    // Get channel's last message number
    const lastMessageNo = await this.messageRepository.getChannelLastMessageNo(
      workspaceId,
      channelId
    );

    // Get user's read receipt
    const receipt = await this.readReceiptRepository.getReadReceipt(
      workspaceId,
      channelId,
      userId
    );

    const lastReadMessageNo = receipt?.lastReadMessageNo || 0;
    const unreadCount = Math.max(0, lastMessageNo - lastReadMessageNo);

    return {
      channelId,
      unreadCount,
      lastMessageNo,
      lastReadMessageNo,
    };
  }

  /**
   * Get unread counts for all channels in a workspace
   */
  async getUnreadCountsForWorkspace(
    workspaceId: string,
    userId: string,
    channelIds: string[]
  ): Promise<WorkspaceUnreadCountsResponse> {
    logger.info("Getting unread counts for workspace", {
      workspaceId,
      userId,
      channelCount: channelIds.length,
    });

    if (channelIds.length === 0) {
      return {
        workspaceId,
        channels: [],
        totalUnread: 0,
      };
    }

    // Get unread counts for all channels in a single query
    const channels = await this.readReceiptRepository.getUnreadCountsForUser(
      workspaceId,
      userId,
      channelIds
    );

    // Calculate total unread
    const totalUnread = channels.reduce(
      (sum, channel) => sum + channel.unreadCount,
      0
    );

    logger.info("Unread counts retrieved", {
      workspaceId,
      userId,
      channelsWithData: channels.length,
      totalUnread,
    });

    return {
      workspaceId,
      channels,
      totalUnread,
    };
  }

  /**
   * Delete all read receipts for a channel
   */
  async deleteReceiptsByChannel(
    workspaceId: string,
    channelId: string
  ): Promise<number> {
    logger.info("Deleting read receipts for channel", {
      workspaceId,
      channelId,
    });

    const count = await this.readReceiptRepository.deleteByChannelId(
      workspaceId,
      channelId
    );

    logger.info("Read receipts deleted for channel", {
      workspaceId,
      channelId,
      count,
    });

    return count;
  }

  /**
   * Delete all read receipts for a workspace
   */
  async deleteReceiptsByWorkspace(workspaceId: string): Promise<number> {
    logger.info("Deleting read receipts for workspace", {
      workspaceId,
    });

    const count =
      await this.readReceiptRepository.deleteByWorkspaceId(workspaceId);

    logger.info("Read receipts deleted for workspace", {
      workspaceId,
      count,
    });

    return count;
  }
}
