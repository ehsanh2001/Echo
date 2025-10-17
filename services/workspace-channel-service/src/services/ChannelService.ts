import { injectable, inject } from "tsyringe";
import { ChannelMember } from "@prisma/client";
import { IChannelService } from "../interfaces/services/IChannelService";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Service for channel operations
 */
@injectable()
export class ChannelService implements IChannelService {
  constructor(
    @inject("IChannelRepository")
    private channelRepository: IChannelRepository
  ) {}

  /**
   * Add a member to a channel or reactivate inactive membership
   */
  async addMemberToChannel(
    channelId: string,
    userId: string,
    joinedBy: string,
    role: string = "member",
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
