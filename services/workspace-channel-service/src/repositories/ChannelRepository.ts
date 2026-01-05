import { inject, injectable } from "tsyringe";
import { PrismaClient, Channel, ChannelMember } from "@prisma/client";
import logger from "../utils/logger";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import {
  CreateChannelData,
  CreateChannelMemberData,
  ChannelWithMembersData,
} from "../types";
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
    logger.error("Error in channel operation:", error);

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
    logger.error("Error in channel member operation:", error);

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
      logger.error("Error finding public channels:", error);
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
      logger.error("Error adding/reactivating channel member:", error);
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
      logger.error("Error adding multiple channel members:", error);
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
      logger.error("Error finding channel by name:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find channel by name: ${error.message}`
      );
    }
  }

  async getChannelMember(
    channelId: string,
    userId: string
  ): Promise<ChannelMember | null> {
    try {
      return await this.prisma.channelMember.findFirst({
        where: {
          userId,
          channelId,
          isActive: true, // Only return active memberships
        },
      });
    } catch (error: any) {
      logger.error("Error finding channel member:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find channel member: ${error.message}`
      );
    }
  }

  /**
   * Gets all channel memberships for a user in a specific workspace.
   * Excludes archived channels and direct channels.
   * Results are sorted alphabetically by channel name.
   * Returns channel data + the user's ChannelMember data.
   */
  async getChannelMembershipsByUserId(
    userId: string,
    workspaceId: string
  ): Promise<
    Array<{
      channel: Channel;
      membership: ChannelMember;
    }>
  > {
    try {
      const memberships = await this.prisma.channelMember.findMany({
        where: {
          userId,
          isActive: true,
          channel: {
            workspaceId,
            isArchived: false,
            type: {
              not: "direct", // Exclude direct channels
            },
          },
        },
        include: {
          channel: true,
        },
        orderBy: {
          channel: {
            name: "asc", // Sort alphabetically by channel name
          },
        },
      });

      return memberships.map((m) => ({
        channel: m.channel,
        membership: m,
      }));
    } catch (error: any) {
      logger.error("Error finding channel memberships by user ID:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find channel memberships: ${error.message}`
      );
    }
  }

  /**
   * Gets channel members for channels the user belongs to within a workspace.
   * Only includes channels the user is a member of (to respect privacy).
   * Excludes archived channels.
   * By default, only returns active members. Channel owners/admins can see all members.
   * Results are grouped by channel.
   */
  async getChannelMembersByWorkspace(
    workspaceId: string,
    userId: string,
    channelIdsWithAdminAccess: string[] = []
  ): Promise<ChannelWithMembersData[]> {
    try {
      // First, get all channels the user is a member of in this workspace
      const userChannelMemberships = await this.prisma.channelMember.findMany({
        where: {
          userId,
          channel: {
            workspaceId,
            isArchived: false,
          },
        },
        select: {
          channelId: true,
        },
      });

      // Extract channel IDs
      const userChannelIds = userChannelMemberships.map((m) => m.channelId);

      // If user has no channels, return empty array
      if (userChannelIds.length === 0) {
        return [];
      }

      // Find all channels the user has access to
      const channels = await this.prisma.channel.findMany({
        where: {
          workspaceId,
          id: {
            in: userChannelIds,
          },
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          type: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // For each channel, get members (all members if user is admin/owner, else only active)
      const channelsWithMembers = await Promise.all(
        channels.map(async (channel) => {
          // Check if user has admin access to this channel
          const hasAdminAccess = channelIdsWithAdminAccess.includes(channel.id);

          const whereClause: any = {
            channelId: channel.id,
          };

          // If user doesn't have admin access, only show active members
          if (!hasAdminAccess) {
            whereClause.isActive = true;
          }

          const members = await this.prisma.channelMember.findMany({
            where: whereClause,
            select: {
              userId: true,
              role: true,
              joinedAt: true,
              isActive: true,
            },
            orderBy: {
              joinedAt: "asc",
            },
          });

          return {
            channelId: channel.id,
            channelName: channel.name,
            channelDisplayName: channel.displayName,
            channelType: channel.type,
            members,
          };
        })
      );

      return channelsWithMembers;
    } catch (error: any) {
      logger.error("Error getting channel members by workspace:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to get channel members: ${error.message}`
      );
    }
  }

  /**
   * Finds a channel by its ID within a workspace.
   * Includes workspaceId for partition-aware queries.
   */
  async findById(
    workspaceId: string,
    channelId: string
  ): Promise<Channel | null> {
    try {
      return await this.prisma.channel.findFirst({
        where: {
          id: channelId,
          workspaceId,
        },
      });
    } catch (error: any) {
      logger.error("Error finding channel by ID:", error);
      throw WorkspaceChannelServiceError.database(
        `Failed to find channel: ${error.message}`
      );
    }
  }

  /**
   * Deletes a channel and all its members.
   * Uses a transaction to ensure atomicity.
   * Includes workspaceId for partition-aware queries.
   */
  async deleteChannel(
    workspaceId: string,
    channelId: string,
    transaction?: any
  ): Promise<void> {
    try {
      const executeDelete = async (tx: any) => {
        // First delete all channel members (due to foreign key constraint)
        // Include workspaceId via channel relation for partition-aware query
        await tx.channelMember.deleteMany({
          where: {
            channelId,
            channel: { workspaceId },
          },
        });

        // Then delete the channel itself with workspaceId for partition pruning
        await tx.channel.deleteMany({
          where: {
            id: channelId,
            workspaceId,
          },
        });
      };

      if (transaction) {
        await executeDelete(transaction);
      } else {
        await this.prisma.$transaction(async (tx) => {
          await executeDelete(tx);
        });
      }

      logger.info("Channel deleted successfully", { channelId });
    } catch (error: any) {
      logger.error("Error deleting channel:", error);

      // Handle case where channel doesn't exist
      if (error.code === "P2025") {
        throw WorkspaceChannelServiceError.notFound("Channel", channelId);
      }

      throw WorkspaceChannelServiceError.database(
        `Failed to delete channel: ${error.message}`
      );
    }
  }
}
