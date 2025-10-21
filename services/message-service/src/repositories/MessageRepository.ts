import { inject, injectable } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { IMessageRepository } from "../interfaces/repositories/IMessageRepository";
import { CreateMessageData, MessageResponse } from "../types";
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
}
