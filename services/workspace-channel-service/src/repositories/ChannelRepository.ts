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

  async create(data: CreateChannelData): Promise<Channel> {
    try {
      return await this.prisma.channel.create({
        data: {
          name: data.name,
          displayName: data.displayName || null,
          description: data.description || null,
          type: data.type,
          workspaceId: data.workspaceId,
          createdBy: data.createdBy,
          settings: data.settings || {},
          memberCount: 0, // Will be updated when members are added
        },
      });
    } catch (error: any) {
      console.error("Error creating channel:", error);

      // Handle unique constraint violations
      if (error.code === "P2002") {
        const target = error.meta?.target;
        if (target?.includes("name")) {
          throw WorkspaceChannelServiceError.conflict(
            `Channel name '${data.name}' already exists in this workspace`,
            { field: "name", value: data.name, workspaceId: data.workspaceId }
          );
        }
      }

      throw WorkspaceChannelServiceError.database(
        `Failed to create channel: ${error.message}`,
        { originalError: error.code }
      );
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
      console.error("Error adding channel member:", error);

      // Handle unique constraint violations
      if (error.code === "P2002") {
        throw WorkspaceChannelServiceError.conflict(
          "User is already a member of this channel",
          { channelId: data.channelId, userId: data.userId }
        );
      }

      // Handle foreign key constraint violations
      if (error.code === "P2003") {
        throw WorkspaceChannelServiceError.notFound("Channel", data.channelId);
      }

      throw WorkspaceChannelServiceError.database(
        `Failed to add channel member: ${error.message}`,
        { originalError: error.code }
      );
    }
  }
}
