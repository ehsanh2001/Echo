import { Channel, ChannelMember } from "@prisma/client";
import { CreateChannelData, CreateChannelMemberData } from "../../types";

/**
 * Interface for channel repository operations
 */
export interface IChannelRepository {
  /**
   * Creates a channel and adds the creator as a channel member in a single transaction.
   *
   * This method atomically performs:
   * 1. Creates the channel with memberCount = 1
   * 2. Adds the creator as a channel owner
   *
   * All operations execute in a database transaction - if any step fails,
   * all changes are rolled back automatically.
   *
   * @param data - The channel data to create
   * @param creatorId - The ID of the user creating the channel (will be added as owner)
   * @throws {WorkspaceChannelServiceError} If any operation fails (transaction rolled back)
   * @returns {Promise<Channel>} The created channel
   */
  create(data: CreateChannelData, creatorId: string): Promise<Channel>;

  /**
   * Creates a channel within an existing transaction context.
   * Used by WorkspaceRepository to create the default channel as part of workspace creation.
   * Prisma doesn't allow nested $transaction() calls, so we need this method.
   *    In nested transactions, the inner transaction does not see the uncommitted data of
   *    the outer transaction.
   *    So foreign key violations may occur if the outer transaction has not yet committed.
   *
   * @param tx - The Prisma transaction context
   * @param data - The channel data to create
   * @param creatorId - The ID of the user creating the channel
   * @returns {Promise<Channel>} The created channel
   */
  createInTransaction(
    tx: any,
    data: CreateChannelData,
    creatorId: string
  ): Promise<Channel>;

  /**
   * Adds a member to an existing channel (increments memberCount).
   *
   * @param data - The channel member data
   * @throws {WorkspaceChannelServiceError} If member already exists or channel not found
   * @returns {Promise<ChannelMember>} The created membership
   */
  addMember(data: CreateChannelMemberData): Promise<ChannelMember>;

  /**
   * Finds all public, non-archived channels in a workspace.
   * Used when adding a user to all public channels.
   *
   * @param workspaceId - The workspace ID
   * @param transaction - Optional Prisma transaction context
   * @returns {Promise<Channel[]>} Array of public channels
   */
  findPublicChannelsByWorkspace(
    workspaceId: string,
    transaction?: any
  ): Promise<Channel[]>;

  /**
   * Adds a member to a channel or reactivates an inactive membership.
   * Supports transaction context for atomic operations.
   *
   * @param channelId - The channel ID
   * @param userId - The user ID to add
   * @param joinedBy - The user ID who added this member
   * @param role - The role to assign (default: 'member')
   * @param transaction - Optional Prisma transaction context
   * @returns {Promise<ChannelMember>} The created or reactivated membership
   */
  addOrReactivateMember(
    channelId: string,
    userId: string,
    joinedBy: string,
    role: string,
    transaction?: any
  ): Promise<ChannelMember>;
}
