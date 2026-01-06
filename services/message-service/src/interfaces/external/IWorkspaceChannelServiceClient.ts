import { ChannelMember } from "../../types";

/**
 * Interface for external workspace-channel service client
 */
export interface IWorkspaceChannelServiceClient {
  /**
   * Check if a user is a member of a channel
   * @param workspaceId - The workspace ID
   * @param channelId - The channel ID
   * @param userId - The user ID
   * @returns Promise resolving to channel member data or null if not a member
   */
  getChannelMember(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ChannelMember | null>;

  /**
   * Invalidate all cached channel membership entries for a channel
   * Called when a channel is deleted to prevent stale cache hits
   * @param workspaceId - The workspace ID
   * @param channelId - The channel ID
   * @returns Promise resolving to the number of cache entries deleted
   */
  invalidateChannelMembershipCache(
    workspaceId: string,
    channelId: string
  ): Promise<number>;
}
