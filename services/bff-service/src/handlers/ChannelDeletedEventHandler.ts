import { injectable } from "tsyringe";
import { IChannelDeletedEventHandler } from "../interfaces/handlers";
import { ChannelDeletedEvent } from "../types/rabbitmq.types";
import { BaseSocketEventHandler } from "./BaseSocketEventHandler";
import logger from "../utils/logger";

/**
 * Handler for channel deletion events
 *
 * Critical event that must be delivered reliably.
 * Broadcasts deletion notification to all clients in the channel room,
 * then removes all sockets from the room.
 */
@injectable()
export class ChannelDeletedEventHandler
  extends BaseSocketEventHandler
  implements IChannelDeletedEventHandler
{
  /**
   * Handle channel.deleted event
   * Broadcasts deletion notification and removes sockets from channel room
   */
  async handleChannelDeleted(event: ChannelDeletedEvent): Promise<void> {
    const io = this.getIO();
    const { channelId, workspaceId, channelName, deletedBy } = event.data;

    // Channel room name
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    // Get all sockets in the room before broadcasting
    const socketsInRoom = await io.in(roomName).fetchSockets();
    const socketCount = socketsInRoom.length;

    // Broadcast channel deleted event to all clients in the channel room
    io.to(roomName).emit("channel:deleted", {
      channelId,
      workspaceId,
      channelName,
      deletedBy,
    });

    logger.info("Broadcasted channel:deleted event", {
      channelId,
      workspaceId,
      channelName,
      deletedBy,
      room: roomName,
      socketCount,
    });

    // Remove all sockets from the channel room
    for (const socket of socketsInRoom) {
      socket.leave(roomName);
    }

    logger.info("Removed all sockets from deleted channel room", {
      channelId,
      workspaceId,
      room: roomName,
      socketsRemoved: socketCount,
    });
  }
}
