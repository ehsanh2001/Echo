import { inject, injectable } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { IMessageRepository } from "../interfaces/repositories/IMessageRepository";
import {
  CreateMessageData,
  MessageResponse,
  PaginationDirection,
} from "../types";
import { MessageServiceError } from "../utils/errors";

/**
 * Repository implementation for message operations using Prisma
 *
 * Handles all database operations for messages including:
 * - Creating messages with atomic message number generation
 * - Type conversions (bigint to number for JSON serialization)
 * - Error handling and mapping to MessageServiceError
 */
@injectable()
export class MessageRepository implements IMessageRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  /**
   * Get the next message number for a channel using PostgreSQL function
   *
   * This operation is atomic and thread-safe. The get_next_message_no()
   * function handles creating the channel_sequence record if it doesn't exist.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @returns Next message number as bigint
   * @throws MessageServiceError if database operation fails
   */
  private async getNextMessageNo(
    workspaceId: string,
    channelId: string
  ): Promise<bigint> {
    try {
      // Call PostgreSQL function to get next message number atomically
      // Using Prisma.sql for explicit parameterization (safest approach)
      const result = await this.prisma.$queryRaw<
        [{ get_next_message_no: bigint }]
      >(
        Prisma.sql`SELECT get_next_message_no(${workspaceId}::UUID, ${channelId}::UUID)`
      );

      const messageNo = result[0]?.get_next_message_no;

      if (!messageNo) {
        throw MessageServiceError.database(
          "Failed to generate message number",
          { workspaceId, channelId, result }
        );
      }

      return messageNo;
    } catch (error) {
      // Re-throw if already a MessageServiceError
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // Wrap other errors as database errors with automatic logging
      throw MessageServiceError.databaseWithLogging(
        "Failed to generate message number due to internal error",
        "getNextMessageNo",
        {
          workspaceId,
          channelId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Find a message by its unique ID
   *
   * @param messageId - Message UUID
   * @returns Message if found, null otherwise
   * @throws MessageServiceError if query fails
   */
  async findById(messageId: string): Promise<MessageResponse | null> {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          workspaceId: true,
          channelId: true,
          messageNo: true,
          userId: true,
          content: true,
          contentType: true,
          isEdited: true,
          editCount: true,
          deliveryStatus: true,
          parentMessageId: true,
          threadRootId: true,
          threadDepth: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!message) {
        return null;
      }

      // Convert bigint messageNo to number for JSON serialization
      return {
        ...message,
        messageNo: Number(message.messageNo),
      };
    } catch (error) {
      // Re-throw if already a MessageServiceError
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // Wrap other errors as database errors with automatic logging
      throw MessageServiceError.databaseWithLogging(
        "Failed to find message by ID due to internal error",
        "findById",
        {
          messageId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Create a new message in the database
   *
   * Automatically generates the next message number and inserts the message
   * in a single operation. The message number is generated per channel.
   *
   * @param data - Message data to create (messageNo generated internally)
   * @returns Created message with all fields including generated messageNo
   * @throws MessageServiceError if creation fails
   */
  async create(data: CreateMessageData): Promise<MessageResponse> {
    let messageNo: bigint | undefined;

    try {
      // Step 1: Get the next message number atomically
      messageNo = await this.getNextMessageNo(data.workspaceId, data.channelId);

      // Step 2: Create message using Prisma with generated message number
      const message = await this.prisma.message.create({
        data: {
          workspaceId: data.workspaceId,
          channelId: data.channelId,
          messageNo: messageNo,
          userId: data.userId,
          content: data.content,
          contentType: data.contentType || "text",
          isEdited: false,
          editCount: 0,
          deliveryStatus: "sent",
          parentMessageId: data.parentMessageId || null,
          threadRootId: data.threadRootId || null,
          threadDepth: data.threadDepth || 0,
        },
      });

      // Return message with messageNo converted to number for JSON serialization
      return {
        ...message,
        messageNo: Number(message.messageNo), // Convert bigint to number
      };
    } catch (error) {
      // Handle Prisma unique constraint violations
      if (error && typeof error === "object" && "code" in error) {
        const prismaError = error as {
          code: string;
          meta?: Record<string, unknown>;
        };

        if (prismaError.code === "P2002") {
          throw MessageServiceError.conflict(
            "Message already exists with this workspace, channel, and message number",
            {
              workspaceId: data.workspaceId,
              channelId: data.channelId,
              messageNo: messageNo ? messageNo.toString() : "unknown",
            }
          );
        }

        if (prismaError.code === "P2003") {
          throw MessageServiceError.validationWithLogging(
            "Invalid reference in message data",
            "create - foreign key constraint",
            {
              workspaceId: data.workspaceId,
              channelId: data.channelId,
              meta: prismaError.meta,
            }
          );
        }
      }

      // Re-throw if already a MessageServiceError
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // Wrap other errors as database errors with automatic logging
      throw MessageServiceError.databaseWithLogging(
        "Failed to create message due to internal error",
        "create",
        {
          workspaceId: data.workspaceId,
          channelId: data.channelId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Get messages with cursor-based pagination
   *
   * Always returns messages in ascending order (oldest to newest) by messageNo.
   * This provides a consistent, predictable interface regardless of direction.
   *
   * For BEFORE direction, fetches in DESC order first to get the most recent N messages
   * before the cursor, then reverses to return in ASC order.
   *
   * @param workspaceId - Workspace UUID
   * @param channelId - Channel UUID
   * @param cursor - Message number to paginate from
   * @param limit - Maximum number of messages to return (+ 1 to check hasMore)
   * @param direction - PaginationDirection.BEFORE for older messages (< cursor), PaginationDirection.AFTER for newer messages (> cursor)
   * @returns Array of messages in ascending order (oldest to newest)
   * @throws MessageServiceError if query fails
   */
  async getMessagesWithCursor(
    workspaceId: string,
    channelId: string,
    cursor: number,
    limit: number,
    direction: PaginationDirection
  ): Promise<MessageResponse[]> {
    try {
      // Build WHERE condition based on direction
      const whereCondition = {
        workspaceId,
        channelId,
        messageNo:
          direction === PaginationDirection.BEFORE
            ? { lt: BigInt(cursor) }
            : { gt: BigInt(cursor) },
      };

      // For BEFORE: Query DESC to get most recent messages before cursor, then reverse
      // For AFTER: Query ASC directly
      const messages = await this.prisma.message.findMany({
        where: whereCondition,
        orderBy: {
          messageNo: direction === PaginationDirection.BEFORE ? "desc" : "asc",
        },
        take: limit,
        select: {
          id: true,
          workspaceId: true,
          channelId: true,
          messageNo: true,
          userId: true,
          content: true,
          contentType: true,
          isEdited: true,
          editCount: true,
          deliveryStatus: true,
          parentMessageId: true,
          threadRootId: true,
          threadDepth: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Convert bigint messageNo to number for JSON serialization
      const convertedMessages = messages.map((message) => ({
        ...message,
        messageNo: Number(message.messageNo),
      }));

      // For BEFORE direction, reverse to return in ASC order (oldest to newest)
      // For AFTER direction, already in ASC order
      return direction === PaginationDirection.BEFORE
        ? convertedMessages.reverse()
        : convertedMessages;
    } catch (error) {
      // Re-throw if already a MessageServiceError
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // Wrap other errors as database errors with automatic logging
      throw MessageServiceError.databaseWithLogging(
        `Failed to get messages ${direction} cursor due to internal error`,
        `getMessagesWithCursor (${direction})`,
        {
          workspaceId,
          channelId,
          cursor,
          limit,
          direction,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Delete all messages for a channel
   *
   * Uses bulk delete with workspaceId for partition-aware queries.
   * This is called when a channel is deleted.
   *
   * @param workspaceId - Workspace UUID (partition key)
   * @param channelId - Channel UUID
   * @returns Number of messages deleted
   * @throws MessageServiceError if deletion fails
   */
  async deleteByChannelId(
    workspaceId: string,
    channelId: string
  ): Promise<number> {
    try {
      // Use deleteMany with both workspaceId and channelId for partition pruning
      const result = await this.prisma.message.deleteMany({
        where: {
          workspaceId,
          channelId,
        },
      });

      return result.count;
    } catch (error) {
      // Re-throw if already a MessageServiceError
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // Wrap other errors as database errors with automatic logging
      throw MessageServiceError.databaseWithLogging(
        "Failed to delete messages for channel due to internal error",
        "deleteByChannelId",
        {
          workspaceId,
          channelId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Delete all messages for a workspace
   *
   * Uses bulk delete with workspaceId (partition key) for efficient deletion
   * across all channels in the workspace. Called when a workspace is deleted.
   *
   * @param workspaceId - Workspace UUID (partition key)
   * @returns Number of messages deleted
   * @throws MessageServiceError if deletion fails
   */
  async deleteByWorkspaceId(workspaceId: string): Promise<number> {
    try {
      // Use deleteMany with only workspaceId for partition-aware bulk deletion
      const result = await this.prisma.message.deleteMany({
        where: {
          workspaceId,
        },
      });

      return result.count;
    } catch (error) {
      // Re-throw if already a MessageServiceError
      if (error instanceof MessageServiceError) {
        throw error;
      }

      // Wrap other errors as database errors with automatic logging
      throw MessageServiceError.databaseWithLogging(
        "Failed to delete messages for workspace due to internal error",
        "deleteByWorkspaceId",
        {
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }
}
