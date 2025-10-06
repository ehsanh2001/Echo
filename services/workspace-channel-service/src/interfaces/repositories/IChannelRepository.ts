import { Channel, ChannelMember } from "@prisma/client";
import { CreateChannelData, CreateChannelMemberData } from "../../types";

/**
 * Interface for channel repository operations
 * Currently implements: Create Workspace user story (creates default 'general' channel)
 */
export interface IChannelRepository {
  /**
   * Create a new channel
   */
  create(data: CreateChannelData): Promise<Channel>;

  /**
   * Add member to channel
   */
  addMember(data: CreateChannelMemberData): Promise<ChannelMember>;
}
