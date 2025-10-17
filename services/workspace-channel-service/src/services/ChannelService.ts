import { injectable, inject } from "tsyringe";
import { ChannelMember, PrismaClient } from "@prisma/client";
import { IChannelService } from "../interfaces/services/IChannelService";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { WorkspaceChannelServiceError } from "../utils/errors";
import {
  CreateChannelRequest,
  CreateChannelResponse,
  CreateChannelData,
  ChannelType,
  ChannelRole,
  WorkspaceRole,
} from "../types";

/**
 * Service for channel operations
 */
@injectable()
export class ChannelService implements IChannelService {
  constructor(
    @inject("IChannelRepository")
    private channelRepository: IChannelRepository,
    @inject("IWorkspaceRepository")
    private workspaceRepository: IWorkspaceRepository,
    @inject(PrismaClient)
    private prisma: PrismaClient
  ) {}

  /**
   * Creates a new channel in a workspace
   */
  async createChannel(
    workspaceId: string,
    userId: string,
    request: CreateChannelRequest
  ): Promise<CreateChannelResponse> {
    try {
      // 1. Validate the request based on channel type
      this.validateChannelRequest(request);

      // 2. Verify user is a member of the workspace and check permissions
      const membership = await this.workspaceRepository.getMembership(
        userId,
        workspaceId
      );

      if (!membership || !membership.isActive) {
        throw WorkspaceChannelServiceError.forbidden(
          "User is not a member of this workspace"
        );
      }

      // 3. Check if user can create this type of channel
      this.checkUserCanCreateChannelType(membership.role, request.type);

      // 4. For named channels, check for duplicates
      if (request.name) {
        const existing = await this.channelRepository.findByNameInWorkspace(
          workspaceId,
          request.name
        );
        if (existing) {
          throw WorkspaceChannelServiceError.conflict(
            `Channel name '${request.name}' already exists in this workspace`,
            { field: "name", value: request.name }
          );
        }
      }

      // 5. Prepare channel data
      const channelData = this.prepareChannelData(workspaceId, userId, request);

      // 6. Create channel with members in a transaction
      return await this.createChannelWithMembers(channelData, userId, request);
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      console.error("Error creating channel:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to create channel due to unexpected error"
      );
    }
  }

  /**
   * Validates channel creation request based on type
   */
  private validateChannelRequest(request: CreateChannelRequest): void {
    const { type, name, participants } = request;

    // Public and private channels must have a name
    if (
      (type === ChannelType.public || type === ChannelType.private) &&
      !name?.trim()
    ) {
      throw WorkspaceChannelServiceError.validation(
        `Channel name is required for ${type} channels`,
        { field: "name", type }
      );
    }

    // Direct and group_dm channels must have participants
    if (
      (type === ChannelType.direct || type === ChannelType.group_dm) &&
      !participants?.length
    ) {
      throw WorkspaceChannelServiceError.validation(
        `Participants are required for ${type} channels`,
        { field: "participants", type }
      );
    }

    // Direct channels must have exactly 1 participant (the other user)
    if (
      type === ChannelType.direct &&
      participants &&
      participants.length !== 1
    ) {
      throw WorkspaceChannelServiceError.validation(
        "Direct channels must have exactly 1 participant (the other user)",
        { field: "participants", count: participants.length }
      );
    }

    // Group DM must have at least 2 participants (plus creator = 3+ total)
    if (
      type === ChannelType.group_dm &&
      participants &&
      participants.length < 2
    ) {
      throw WorkspaceChannelServiceError.validation(
        "Group DM channels must have at least 2 other participants",
        { field: "participants", count: participants.length }
      );
    }
  }

  /**
   * Checks if user has permission to create this type of channel
   */
  private checkUserCanCreateChannelType(
    userRole: WorkspaceRole,
    channelType: ChannelType
  ): void {
    // Owner and admin can create any type
    if (userRole === WorkspaceRole.owner || userRole === WorkspaceRole.admin) {
      return;
    }

    // Members can only create direct and group_dm channels
    if (
      channelType === ChannelType.public ||
      channelType === ChannelType.private
    ) {
      throw WorkspaceChannelServiceError.forbidden(
        `Only workspace owners and admins can create ${channelType} channels`
      );
    }
  }

  /**
   * Generates a consistent name for direct channels
   */
  private generateDirectChannelName(userId1: string, userId2: string): string {
    // Sort user IDs alphabetically for consistency
    const [user1, user2] = [userId1, userId2].sort();
    return `dm-${user1}-${user2}`;
  }

  /**
   * Prepares channel data for creation
   */
  private prepareChannelData(
    workspaceId: string,
    userId: string,
    request: CreateChannelRequest
  ): CreateChannelData {
    let channelName: string;

    // Generate name for direct channels
    if (request.type === ChannelType.direct) {
      const otherUserId = request.participants?.[0];
      if (!otherUserId) {
        throw WorkspaceChannelServiceError.validation(
          "Participant user ID is required for direct channels"
        );
      }
      channelName = this.generateDirectChannelName(userId, otherUserId);
    } else if (request.type === ChannelType.group_dm) {
      // For group DMs, generate a name based on creator ID and timestamp
      channelName = `group-dm-${userId}-${Date.now()}`;
    } else {
      // Use provided name for public/private channels
      channelName = request.name!;
    }

    return {
      workspaceId,
      name: channelName,
      displayName: request.displayName || null,
      description: request.description || null,
      type: request.type,
      createdBy: userId,
      memberCount: 1, // Creator is the first member
    };
  }

  /**
   * Creates channel and adds members atomically
   */
  private async createChannelWithMembers(
    channelData: CreateChannelData,
    creatorId: string,
    request: CreateChannelRequest
  ): Promise<CreateChannelResponse> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create channel with creator as owner (creator is automatically added as a member)
      const channel = await this.channelRepository.create(
        channelData,
        creatorId,
        tx
      );

      // 2. Add participants if this is a direct or group_dm channel
      if (request.participants && request.participants.length > 0) {
        await this.channelRepository.addMembers(
          channel.id,
          request.participants.map((userId) => ({
            userId,
            role: ChannelRole.member,
            joinedBy: creatorId,
          })),
          tx
        );
      }

      // 3. Get all channel members (including creator who was added by create())
      const allMembers = await tx.channelMember.findMany({
        where: {
          channelId: channel.id,
          isActive: true,
        },
        orderBy: {
          joinedAt: "asc", // Creator first
        },
      });

      // 4. Return the complete response
      return {
        id: channel.id,
        workspaceId: channel.workspaceId,
        name: channel.name,
        displayName: channel.displayName,
        description: channel.description,
        type: channel.type,
        createdBy: channel.createdBy ?? creatorId, // Ensure it's never null
        isArchived: channel.isArchived,
        isReadOnly: false, // Default value
        memberCount: channel.memberCount,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
        members: allMembers.map((m) => ({
          userId: m.userId,
          role: m.role,
        })),
      };
    });
  }

  /**
   * Add a member to a channel or reactivate inactive membership
   */
  async addMemberToChannel(
    channelId: string,
    userId: string,
    joinedBy: string,
    role: ChannelRole = ChannelRole.member,
    transaction?: any
  ): Promise<ChannelMember> {
    try {
      return await this.channelRepository.addOrReactivateMember(
        channelId,
        userId,
        joinedBy,
        role,
        transaction
      );
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      console.error("Error adding member to channel:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to add member to channel"
      );
    }
  }
}
