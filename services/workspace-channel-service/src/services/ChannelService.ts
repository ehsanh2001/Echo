import { injectable, inject } from "tsyringe";
import { ChannelMember, PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { IChannelService } from "../interfaces/services/IChannelService";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { IOutboxService } from "../interfaces/services/IOutboxService";
import { WorkspaceChannelServiceError } from "../utils/errors";
import { UserServiceClient } from "./userServiceClient";
import {
  CreateChannelRequest,
  CreateChannelResponse,
  CreateChannelData,
  ChannelType,
  ChannelRole,
  WorkspaceRole,
  EnrichedUserInfo,
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
    @inject("IOutboxService")
    private outboxService: IOutboxService,
    @inject("UserServiceClient")
    private userServiceClient: UserServiceClient,
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
      logger.error("Error creating channel:", error);
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
      memberCount: 1, // Creator is the first member (will be updated for public channels)
    };
  }

  /**
   * Creates channel and adds members atomically
   * - For PUBLIC channels: auto-adds all workspace members
   * - For PRIVATE channels: adds only specified participants
   * - For DIRECT/GROUP_DM: adds specified participants
   * Also emits a channel.created event with full member data
   */
  private async createChannelWithMembers(
    channelData: CreateChannelData,
    creatorId: string,
    request: CreateChannelRequest
  ): Promise<CreateChannelResponse> {
    // 1. Determine which members to add
    const memberUserIds = await this.determineMembersToAdd(
      channelData.workspaceId,
      creatorId,
      request
    );

    // 2. Create channel and add members in transaction
    const { channel, allMembers } =
      await this.createChannelAndAddMembersInTransaction(
        channelData,
        creatorId,
        memberUserIds
      );

    // 3. Fetch enriched user info for all members
    const userDetailsMap = await this.enrichMembersWithUserInfo(allMembers);

    // 4. Emit channel.created event with full member data
    await this.emitChannelCreatedEvent(
      channel,
      allMembers,
      userDetailsMap,
      request.type,
      creatorId
    );

    // 5. Return the complete response
    return this.buildChannelResponse(channel, allMembers, creatorId);
  }

  /**
   * Determines which users should be added to the channel based on type
   */
  private async determineMembersToAdd(
    workspaceId: string,
    creatorId: string,
    request: CreateChannelRequest
  ): Promise<string[]> {
    if (request.type === ChannelType.public) {
      // For public channels, get ALL active workspace members
      const workspaceMembers = await this.workspaceRepository.getMembers(
        workspaceId,
        false // Only active members
      );
      const memberIds = workspaceMembers.map((m) => m.userId);
      logger.info(
        `Public channel: will add ${memberIds.length} workspace members`
      );
      return memberIds;
    } else if (request.type === ChannelType.private) {
      // For private channels, use participants + creator
      const memberIds = [
        creatorId,
        ...(request.participants || []).filter((id) => id !== creatorId),
      ];
      logger.info(
        `Private channel: will add ${memberIds.length} selected members`
      );
      return memberIds;
    } else {
      // For direct/group_dm, use participants + creator
      return [
        creatorId,
        ...(request.participants || []).filter((id) => id !== creatorId),
      ];
    }
  }

  /**
   * Creates channel and adds members in a database transaction
   */
  private async createChannelAndAddMembersInTransaction(
    channelData: CreateChannelData,
    creatorId: string,
    memberUserIds: string[]
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Create channel with creator as owner
      const channel = await this.channelRepository.create(
        { ...channelData, memberCount: memberUserIds.length },
        creatorId,
        tx
      );

      // Add additional members (excluding creator who was already added)
      const additionalMembers = memberUserIds.filter((id) => id !== creatorId);
      if (additionalMembers.length > 0) {
        await this.channelRepository.addMembers(
          channel.id,
          additionalMembers.map((userId) => ({
            userId,
            role: ChannelRole.member,
            joinedBy: creatorId,
          })),
          tx
        );
      }

      // Get all channel members with their data
      const allMembers = await tx.channelMember.findMany({
        where: {
          channelId: channel.id,
          isActive: true,
        },
        orderBy: {
          joinedAt: "asc", // Creator first
        },
      });

      return { channel, allMembers };
    });
  }

  /**
   * Fetches enriched user info for channel members
   */
  private async enrichMembersWithUserInfo(
    allMembers: ChannelMember[]
  ): Promise<Map<string, EnrichedUserInfo>> {
    try {
      return await this.userServiceClient.getUsersByIds(
        allMembers.map((m) => m.userId)
      );
    } catch (error) {
      logger.warn(
        "Failed to fetch user details for channel members, proceeding without enrichment",
        error
      );
      return new Map<string, EnrichedUserInfo>();
    }
  }

  /**
   * Emits a channel.created event to the outbox
   */
  private async emitChannelCreatedEvent(
    channel: any,
    allMembers: ChannelMember[],
    userDetailsMap: Map<string, EnrichedUserInfo>,
    channelType: ChannelType,
    creatorId: string
  ): Promise<void> {
    const isPrivate = channelType === ChannelType.private;
    try {
      await this.outboxService.createChannelCreatedEvent({
        channelId: channel.id,
        workspaceId: channel.workspaceId,
        channelName: channel.name,
        channelDisplayName: channel.displayName,
        channelDescription: channel.description,
        channelType: channel.type,
        createdBy: channel.createdBy ?? creatorId,
        memberCount: allMembers.length,
        isPrivate,
        members: allMembers.map((m) => ({
          userId: m.userId,
          channelId: m.channelId,
          role: m.role,
          joinedAt: m.joinedAt,
          isActive: m.isActive,
          user: userDetailsMap.get(m.userId) || {
            id: m.userId,
            username: "unknown",
            displayName: "Unknown User",
            email: "",
            avatarUrl: null,
            lastSeen: null,
          },
        })),
        createdAt: channel.createdAt,
      });
      logger.info(
        `Created channel.created event for ${channel.name} with ${allMembers.length} members (isPrivate: ${isPrivate})`
      );
    } catch (error) {
      logger.error("Failed to create channel.created event", error);
      // Don't fail the channel creation if event creation fails
    }
  }

  /**
   * Builds the CreateChannelResponse from channel and members data
   */
  private buildChannelResponse(
    channel: any,
    allMembers: ChannelMember[],
    creatorId: string
  ): CreateChannelResponse {
    return {
      id: channel.id,
      workspaceId: channel.workspaceId,
      name: channel.name,
      displayName: channel.displayName,
      description: channel.description,
      type: channel.type,
      createdBy: channel.createdBy ?? creatorId,
      isArchived: channel.isArchived,
      isReadOnly: false,
      memberCount: allMembers.length,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
      members: allMembers.map((m) => ({
        userId: m.userId,
        role: m.role,
      })),
    };
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
      logger.error("Error adding member to channel:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to add member to channel"
      );
    }
  }

  /**
   * Gets a channel member by workspace, channel, and user IDs.
   */
  async getChannelMember(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelMember | null> {
    try {
      return await this.channelRepository.getChannelMember(channelId, userId);
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      logger.error("Error getting channel member:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to get channel member"
      );
    }
  }

  /**
   * Checks if a channel name is available in a workspace
   */
  async isChannelNameAvailable(
    workspaceId: string,
    name: string
  ): Promise<boolean> {
    try {
      const existingChannel =
        await this.channelRepository.findByNameInWorkspace(workspaceId, name);
      return existingChannel === null;
    } catch (error) {
      logger.error("Error checking channel name availability:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to check channel name availability"
      );
    }
  }

  /**
   * Deletes a channel from a workspace.
   * Only channel owners or workspace owners can delete a channel.
   * The "general" channel cannot be deleted.
   */
  async deleteChannel(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<{ channelId: string; workspaceId: string }> {
    try {
      // 1. Find the channel (include workspaceId for partition-aware query)
      const channel = await this.channelRepository.findById(
        workspaceId,
        channelId
      );
      if (!channel) {
        throw WorkspaceChannelServiceError.notFound("Channel", channelId);
      }

      // 3. Check if this is the "general" channel (protected)
      if (channel.name.toLowerCase() === "general") {
        throw WorkspaceChannelServiceError.badRequest(
          "The general channel cannot be deleted"
        );
      }

      // 4. Check permissions: user must be channel owner OR workspace owner
      const [channelMember, workspaceMember] = await Promise.all([
        this.channelRepository.getChannelMember(channelId, userId),
        this.workspaceRepository.getMembership(userId, workspaceId),
      ]);

      const isChannelOwner = channelMember?.role === ChannelRole.owner;
      const isWorkspaceOwner = workspaceMember?.role === WorkspaceRole.owner;

      if (!isChannelOwner && !isWorkspaceOwner) {
        throw WorkspaceChannelServiceError.forbidden(
          "Only channel owners or workspace owners can delete a channel"
        );
      }

      // 5. Delete the channel and create outbox event in a single transaction
      // This follows the Transactional Outbox pattern - both the domain change (deletion)
      // and the event creation must succeed or fail together atomically
      await this.prisma.$transaction(async (tx) => {
        // Delete the channel and its members (include workspaceId for partition-aware query)
        await this.channelRepository.deleteChannel(workspaceId, channelId, tx);

        // Create outbox event for channel deleted (in same transaction)
        // The OutboxPublisher worker will poll this and publish to RabbitMQ
        await this.outboxService.createChannelDeletedEvent({
          channelId,
          workspaceId,
          deletedBy: userId,
        });
      });

      logger.info("Channel deleted successfully", {
        channelId,
        workspaceId,
        deletedBy: userId,
        channelName: channel.name,
      });

      return { channelId, workspaceId };
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      logger.error("Error deleting channel:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to delete channel due to unexpected error"
      );
    }
  }
}
