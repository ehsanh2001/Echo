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
        displayName: data.displayName ?? null,
        description: data.description ?? null,
        type: data.type,
        workspaceId: data.workspaceId,
        createdBy: data.createdBy ?? null,
        settings: data.settings ?? {},
        memberCount: 1,
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

  async create(
    data: CreateChannelData,
    creatorId: string,
    transaction?: any
  ): Promise<Channel> {
    try {
      // If transaction provided, use it; otherwise create a new transaction
      if (transaction) {
        return await this.createInTransaction(transaction, data, creatorId);
      }

      // Use transaction to create channel and add creator as member atomically
      return await this.prisma.$transaction(async (tx) => {
        return await this.createInTransaction(tx, data, creatorId);
      });
    } catch (error: any) {
      this.handleChannelError(error, data);
    }
  }

  /**
   * Finds all public, non-archived channels in a workspace
   */
  async findPublicChannelsByWorkspace(
    workspaceId: string,
    transaction?: any
  ): Promise<Channel[]> {
    try {
      const prismaClient = transaction || this.prisma;

      return await prismaClient.channel.findMany({
        where: {
          workspaceId,
          type: "public",
          isArchived: false,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    } catch (error: any) {
      console.error("Error finding public channels:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find public channels: ${error.message}`
      );
    }
  }

  /**
   * Adds a member to a channel or reactivates an inactive membership.
   * All operations are atomic - wrapped in a transaction.
   */
  async addOrReactivateMember(
    channelId: string,
    userId: string,
    joinedBy: string,
    role: string = "member",
    transaction?: any
  ): Promise<ChannelMember> {
    try {
      const executeInTransaction = async (tx: any) => {
        // Convert empty string to null for joinedBy
        const normalizedJoinedBy = joinedBy?.trim() || null;

        // Check if membership exists to determine if we need to increment count
        const existingMembership = await tx.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId,
              userId,
            },
          },
        });

        const isActive = existingMembership?.isActive ?? false;

        // Upsert the membership
        const member = await tx.channelMember.upsert({
          where: {
            channelId_userId: {
              channelId,
              userId,
            },
          },
          create: {
            channelId,
            userId,
            role: role as any,
            joinedBy: normalizedJoinedBy,
            isActive: true,
          },
          update: {
            isActive: true,
            role: role as any,
            joinedBy: normalizedJoinedBy,
          },
        });

        // Increment member count only if creating new or reactivating inactive
        if (!isActive) {
          await tx.channel.update({
            where: { id: channelId },
            data: {
              memberCount: {
                increment: 1,
              },
            },
          });
        }

        return member;
      };

      // If transaction provided, execute directly in it; otherwise create new transaction
      if (transaction) {
        return await executeInTransaction(transaction);
      }

      return await this.prisma.$transaction(executeInTransaction);
    } catch (error: any) {
      console.error("Error adding/reactivating channel member:", error);
      this.handleChannelMemberError(error, {
        channelId,
        userId,
        role: role as any,
        joinedBy,
      });
    }
  }

  /**
   * Adds multiple members to a channel in a single transaction.
   * Uses addOrReactivateMember for each member to handle reactivation.
   * Used for direct/group_dm channel creation.
   */
  async addMembers(
    channelId: string,
    members: Array<{ userId: string; role: string; joinedBy: string | null }>,
    transaction?: any
  ): Promise<ChannelMember[]> {
    try {
      // If transaction provided, execute directly in it; otherwise create new transaction
      const executeInTransaction = async (tx: any) => {
        // Add all channel members using addOrReactivateMember
        const createdMembers: ChannelMember[] = [];

        for (const member of members) {
          const channelMember = await this.addOrReactivateMember(
            channelId,
            member.userId,
            member.joinedBy ?? member.userId,
            member.role,
            tx
          );
          createdMembers.push(channelMember);
        }

        return createdMembers;
      };

      if (transaction) {
        return await executeInTransaction(transaction);
      }

      return await this.prisma.$transaction(executeInTransaction);
    } catch (error: any) {
      console.error("Error adding multiple channel members:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to add multiple channel members: ${error.message}`,
        { originalError: error.code }
      );
    }
  }

  /**
   * Finds a channel by name within a workspace.
   * Used to check for duplicate channel names.
   */
  async findByNameInWorkspace(
    workspaceId: string,
    name: string
  ): Promise<Channel | null> {
    try {
      return await this.prisma.channel.findFirst({
        where: {
          workspaceId,
          name,
        },
      });
    } catch (error: any) {
      console.error("Error finding channel by name:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find channel by name: ${error.message}`
      );
    }
  }
}
