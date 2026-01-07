import { inject, injectable } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { IReadReceiptRepository } from "../interfaces/repositories/IReadReceiptRepository";
import { ReadReceiptResponse, ChannelUnreadInfo } from "../types";
import { MessageServiceError } from "../utils/errors";

/**
 * Repository implementation for read receipt operations using Prisma
 *
 * Handles all database operations for channel read receipts including:
 * - Upserting read positions
 * - Querying read receipts
 * - Calculating unread counts by joining with channel sequences
 */
@injectable()
export class ReadReceiptRepository implements IReadReceiptRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  /**
   * Upsert a user's read receipt for a channel
   *
   * Uses Prisma's upsert to create or update the read receipt.
   * Only updates if the new messageNo is greater than the current one.
   */
  async upsertReadReceipt(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageNo: number,
    messageId?: string
  ): Promise<ReadReceiptResponse> {
    try {
      const receipt = await this.prisma.channelReadReceipt.upsert({
        where: {
          workspaceId_channelId_userId: {
            workspaceId,
            channelId,
            userId,
          },
        },
        create: {
          workspaceId,
          channelId,
          userId,
          lastReadMessageNo: BigInt(messageNo),
          lastReadMessageId: messageId || null,
          lastReadAt: new Date(),
        },
        update: {
          // Only update if new messageNo is greater
          lastReadMessageNo: {
            set: BigInt(messageNo),
          },
          lastReadMessageId: messageId ?? null,
          lastReadAt: new Date(),
        },
      });

      return this.mapToResponse(receipt);
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.databaseWithLogging(
        "Failed to upsert read receipt",
        "upsertReadReceipt",
        {
          workspaceId,
          channelId,
          userId,
          messageNo,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Get a user's read receipt for a specific channel
   */
  async getReadReceipt(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ReadReceiptResponse | null> {
    try {
      const receipt = await this.prisma.channelReadReceipt.findUnique({
        where: {
          workspaceId_channelId_userId: {
            workspaceId,
            channelId,
            userId,
          },
        },
      });

      if (!receipt) {
        return null;
      }

      return this.mapToResponse(receipt);
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.databaseWithLogging(
        "Failed to get read receipt",
        "getReadReceipt",
        {
          workspaceId,
          channelId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Get all read receipts for a user in a workspace
   */
  async getReadReceiptsForUser(
    workspaceId: string,
    userId: string
  ): Promise<ReadReceiptResponse[]> {
    try {
      const receipts = await this.prisma.channelReadReceipt.findMany({
        where: {
          workspaceId,
          userId,
        },
      });

      return receipts.map((receipt) => this.mapToResponse(receipt));
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.databaseWithLogging(
        "Failed to get read receipts for user",
        "getReadReceiptsForUser",
        {
          workspaceId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Get unread counts for channels in a workspace
   *
   * Joins read receipts with channel sequences to calculate unread counts.
   * Uses raw SQL for efficient calculation across multiple channels.
   */
  async getUnreadCountsForUser(
    workspaceId: string,
    userId: string,
    channelIds: string[]
  ): Promise<ChannelUnreadInfo[]> {
    try {
      if (channelIds.length === 0) {
        return [];
      }

      // Use raw query to join channel_sequences with read_receipts
      // This efficiently calculates unread counts for all channels at once
      const results = await this.prisma.$queryRaw<
        Array<{
          channel_id: string;
          last_message_no: bigint;
          last_read_message_no: bigint | null;
        }>
      >(
        Prisma.sql`
          SELECT 
            cs.channel_id,
            cs.last_message_no,
            crr.last_read_message_no
          FROM channel_sequences cs
          LEFT JOIN channel_read_receipts crr 
            ON cs.workspace_id = crr.workspace_id 
            AND cs.channel_id = crr.channel_id 
            AND crr.user_id = ${userId}::uuid
          WHERE cs.workspace_id = ${workspaceId}::uuid
            AND cs.channel_id = ANY(${channelIds}::uuid[])
        `
      );

      return results.map((row) => {
        const lastMessageNo = Number(row.last_message_no);
        const lastReadMessageNo = row.last_read_message_no
          ? Number(row.last_read_message_no)
          : 0;

        // Calculate unread count (can't be negative)
        const unreadCount = Math.max(0, lastMessageNo - lastReadMessageNo);

        return {
          channelId: row.channel_id,
          unreadCount,
          lastMessageNo,
          lastReadMessageNo,
        };
      });
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.databaseWithLogging(
        "Failed to get unread counts for user",
        "getUnreadCountsForUser",
        {
          workspaceId,
          userId,
          channelCount: channelIds.length,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Delete all read receipts for a channel
   */
  async deleteByChannelId(
    workspaceId: string,
    channelId: string
  ): Promise<number> {
    try {
      const result = await this.prisma.channelReadReceipt.deleteMany({
        where: {
          workspaceId,
          channelId,
        },
      });

      return result.count;
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.databaseWithLogging(
        "Failed to delete read receipts for channel",
        "deleteByChannelId",
        {
          workspaceId,
          channelId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Delete all read receipts for a workspace
   */
  async deleteByWorkspaceId(workspaceId: string): Promise<number> {
    try {
      const result = await this.prisma.channelReadReceipt.deleteMany({
        where: {
          workspaceId,
        },
      });

      return result.count;
    } catch (error) {
      if (error instanceof MessageServiceError) {
        throw error;
      }

      throw MessageServiceError.databaseWithLogging(
        "Failed to delete read receipts for workspace",
        "deleteByWorkspaceId",
        {
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Map Prisma model to response type
   */
  private mapToResponse(receipt: {
    workspaceId: string;
    channelId: string;
    userId: string;
    lastReadMessageNo: bigint;
    lastReadMessageId: string | null;
    lastReadAt: Date;
    updatedAt: Date;
  }): ReadReceiptResponse {
    return {
      workspaceId: receipt.workspaceId,
      channelId: receipt.channelId,
      userId: receipt.userId,
      lastReadMessageNo: Number(receipt.lastReadMessageNo),
      lastReadMessageId: receipt.lastReadMessageId,
      lastReadAt: receipt.lastReadAt.toISOString(),
    };
  }
}
