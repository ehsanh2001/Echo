import { ChannelMember } from "@prisma/client";
import {
  CreateChannelRequest,
  CreateChannelResponse,
  ChannelRole,
} from "../../types";

/**
 * Interface for channel service operations
 */
export interface IChannelService {
  /**
   * Creates a new channel in a workspace
   * @param workspaceId - ID of the workspace
   * @param userId - ID of the user creating the channel
   * @param request - Channel creation request data
   * @returns Created channel with members
   * @throws WorkspaceChannelServiceError if validation fails or user lacks permission
   */
  createChannel(
    workspaceId: string,
    userId: string,
    request: CreateChannelRequest
  ): Promise<CreateChannelResponse>;

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
    role?: ChannelRole,
    transaction?: any
  ): Promise<ChannelMember>;

  /**
   * Gets a channel member by workspace, channel, and user IDs.
   * @param workspaceId - The workspace ID
   * @param channelId - The channel ID
   * @param userId - The user ID
   * @returns Promise resolving to the channel member if found, null otherwise
   */
  getChannelMember(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelMember | null>;
}
