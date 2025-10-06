import { inject, injectable } from "tsyringe";
import { PrismaClient, Channel, ChannelMember } from "@prisma/client";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { CreateChannelData, CreateChannelMemberData } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Prisma implementation of channel repository
 *
 */
@injectable()
export class ChannelRepository implements IChannelRepository {
  constructor(@inject(PrismaClient) private prisma: PrismaClient) {}

  /**
   * Handles Prisma errors for channel operations
   */
  private handleChannelError(
    error: any,
    channelData?: CreateChannelData
  ): never {
    console.error("Error in channel operation:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes("name") && channelData) {
        throw WorkspaceChannelServiceError.conflict(
          `Channel name '${channelData.name}' already exists in this workspace`,
          {
            field: "name",
            value: channelData.name,
            workspaceId: channelData.workspaceId,
          }
        );
      }
    }

    throw WorkspaceChannelServiceError.database(
      `Failed channel operation: ${error.message}`,
      { originalError: error.code }
    );
  }

  /**
   * Handles Prisma errors for channel member operations
   */
  private handleChannelMemberError(
    error: any,
    data?: CreateChannelMemberData
  ): never {
    console.error("Error in channel member operation:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      throw WorkspaceChannelServiceError.conflict(
        "User is already a member of this channel",
        data ? { channelId: data.channelId, userId: data.userId } : undefined
      );
    }

    // Handle foreign key constraint violations
    if (error.code === "P2003" && data) {
      throw WorkspaceChannelServiceError.notFound("Channel", data.channelId);
    }

    throw WorkspaceChannelServiceError.database(
      `Failed to add channel member: ${error.message}`,
      { originalError: error.code }
    );
  }

  /**
   * Creates a channel within an existing transaction context.
   * This is used by WorkspaceRepository when creating the default channel.
   */
  async createInTransaction(
    tx: any,
    data: CreateChannelData,
    creatorId: string
  ): Promise<Channel> {
    // 1. Create the channel with initial memberCount of 1
    const channel = await tx.channel.create({
      data: {
        name: data.name,
        displayName: data.displayName || null,
        description: data.description || null,
        type: data.type,
        workspaceId: data.workspaceId,
        createdBy: creatorId,
        settings: data.settings || {},
        memberCount: 1, // Start with 1 for the creator
      },
    });

    // 2. Add creator as channel owner
    await tx.channelMember.create({
      data: {
        channelId: channel.id,
        userId: creatorId,
        role: "owner",
        joinedBy: creatorId,
      },
    });

    return channel;
  }

  async create(data: CreateChannelData, creatorId: string): Promise<Channel> {
    try {
      // Use transaction to create channel and add creator as member atomically
      // Reuses createInTransaction logic
      return await this.prisma.$transaction(async (tx) => {
        return await this.createInTransaction(tx, data, creatorId);
      });
    } catch (error: any) {
      this.handleChannelError(error, data);
    }
  }

  async addMember(data: CreateChannelMemberData): Promise<ChannelMember> {
    try {
      // Use transaction to ensure both member creation and count increment happen atomically
      return await this.prisma.$transaction(async (tx) => {
        // Create the channel member
        const channelMember = await tx.channelMember.create({
          data: {
            channelId: data.channelId,
            userId: data.userId,
            role: data.role,
            joinedBy: data.joinedBy || null,
          },
        });

        // Increment the member count
        await tx.channel.update({
          where: { id: data.channelId },
          data: {
            memberCount: {
              increment: 1,
            },
          },
        });

        return channelMember;
      });
    } catch (error: any) {
      this.handleChannelMemberError(error, data);
    }
  }
}
