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
}
