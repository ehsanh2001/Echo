import { ChannelMember } from "@prisma/client";

/**
 * Interface for channel service operations
 */
export interface IChannelService {
  /**
   * Add a member to a channel or reactivate inactive membership
   * @param channelId - The channel ID
   * @param userId - The user ID to add
   * @param joinedBy - The user ID who added this member
   * @param role - The role to assign (default: 'member')
   * @param transaction - Optional Prisma transaction context
   * @returns Promise resolving to the channel member
   */
  addMemberToChannel(
    channelId: string,
    userId: string,
    joinedBy: string,
    role?: string,
    transaction?: any
  ): Promise<ChannelMember>;
}
