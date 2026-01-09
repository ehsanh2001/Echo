import { injectable } from "tsyringe";
import { IWorkspaceDeletedEventHandler } from "../interfaces/handlers";
import { WorkspaceDeletedEvent } from "../types/rabbitmq.types";
import { BaseSocketEventHandler } from "./BaseSocketEventHandler";
import logger from "../utils/logger";

/**
 * Handler for workspace deletion events
 *
 * Critical event that must be delivered reliably.
 * Broadcasts deletion notification to all clients in the workspace room,
 * removes all sockets from workspace and channel rooms.
 */
@injectable()
export class WorkspaceDeletedEventHandler
  extends BaseSocketEventHandler
  implements IWorkspaceDeletedEventHandler
{
  /**
   * Handle workspace.deleted event
   * Broadcasts deletion notification and removes sockets from workspace/channel rooms
   */
  async handleWorkspaceDeleted(event: WorkspaceDeletedEvent): Promise<void> {
    const io = this.getIO();
    const { workspaceId, workspaceName, deletedBy, channelIds } = event.data;

    // Workspace room name
    const workspaceRoomName = `workspace:${workspaceId}`;

    // Get all sockets in the workspace room before broadcasting
    const socketsInWorkspaceRoom = await io
      .in(workspaceRoomName)
      .fetchSockets();
    const workspaceSocketCount = socketsInWorkspaceRoom.length;

    // Broadcast workspace deleted event to all clients in the workspace room
    // Clients should handle this by redirecting to another workspace or workspace selection
    io.to(workspaceRoomName).emit("workspace:deleted", {
      workspaceId,
      workspaceName,
      deletedBy,
      channelIds,
    });

    logger.info("Broadcasted workspace:deleted event", {
      workspaceId,
      workspaceName,
      deletedBy,
      room: workspaceRoomName,
      socketCount: workspaceSocketCount,
      channelCount: channelIds.length,
    });

    // Remove all sockets from all channel rooms in this workspace
    let totalChannelSocketsRemoved = 0;
    for (const channelId of channelIds) {
      const channelRoomName = `workspace:${workspaceId}:channel:${channelId}`;
      const socketsInChannelRoom = await io.in(channelRoomName).fetchSockets();

      for (const socket of socketsInChannelRoom) {
        socket.leave(channelRoomName);
      }

      totalChannelSocketsRemoved += socketsInChannelRoom.length;
    }

    logger.info("Removed all sockets from channel rooms", {
      workspaceId,
      channelCount: channelIds.length,
      socketsRemoved: totalChannelSocketsRemoved,
    });

    // Remove all sockets from the workspace room
    for (const socket of socketsInWorkspaceRoom) {
      socket.leave(workspaceRoomName);
    }

    logger.info("Removed all sockets from deleted workspace room", {
      workspaceId,
      workspaceName,
      room: workspaceRoomName,
      socketsRemoved: workspaceSocketCount,
      totalChannelSocketsRemoved,
    });
  }
}
