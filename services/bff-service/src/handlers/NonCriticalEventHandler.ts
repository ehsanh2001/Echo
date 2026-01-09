import { injectable } from "tsyringe";
import { INonCriticalEventHandler } from "../interfaces/handlers";
import { RabbitMQEvent } from "../types/rabbitmq.types";
import { BaseSocketEventHandler } from "./BaseSocketEventHandler";
import logger from "../utils/logger";

/**
 * Handler for non-critical real-time events
 *
 * Handles ephemeral events that can be missed without critical impact:
 * - message.created: New messages in channels
 * - workspace.member.joined/left: Workspace membership changes
 * - channel.member.joined/left: Channel membership changes
 * - channel.created: New channels
 */
@injectable()
export class NonCriticalEventHandler
  extends BaseSocketEventHandler
  implements INonCriticalEventHandler
{
  /**
   * Route and handle a non-critical event
   */
  async handleEvent(event: RabbitMQEvent): Promise<void> {
    // Support both 'type' and 'eventType' for compatibility
    const eventType = (event as any).type || (event as any).eventType;

    logger.info("Routing non-critical event", {
      eventType,
      hasType: !!(event as any).type,
      hasEventType: !!(event as any).eventType,
    });

    switch (eventType) {
      case "message.created":
        await this.handleMessageCreated(event as any);
        break;

      case "workspace.member.joined":
        await this.handleWorkspaceMemberJoined(event);
        break;

      case "workspace.member.left":
        await this.handleWorkspaceMemberLeft(event);
        break;

      case "channel.member.joined":
        await this.handleChannelMemberJoined(event);
        break;

      case "channel.member.left":
        await this.handleChannelMemberLeft(event);
        break;

      case "channel.created":
        await this.handleChannelCreated(event);
        break;

      default:
        logger.warn("Unknown event type", { type: eventType });
    }
  }

  /**
   * Handle message.created event
   * Broadcast to all clients in the channel room
   */
  private async handleMessageCreated(
    event: RabbitMQEvent & { type: "message.created" }
  ): Promise<void> {
    const io = this.getIO();
    const { workspaceId, channelId } = event.payload;

    // Broadcast to channel room
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    io.to(roomName).emit("message:created", event.payload);

    logger.info("Broadcasted message.created", {
      workspaceId,
      channelId,
      messageId: event.payload.id,
      room: roomName,
    });
  }

  /**
   * Handle workspace.member.joined event
   * Broadcast to all clients in the workspace room
   */
  private async handleWorkspaceMemberJoined(
    event: RabbitMQEvent
  ): Promise<void> {
    const io = this.getIO();
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, userId, user } = eventData;

    // Broadcast to workspace room
    const roomName = `workspace:${workspaceId}`;

    io.to(roomName).emit("workspace:member:joined", {
      workspaceId,
      userId,
      user,
    });

    logger.info("Broadcasted workspace.member.joined", {
      workspaceId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle workspace.member.left event
   * Broadcast to all clients in the workspace room
   */
  private async handleWorkspaceMemberLeft(event: RabbitMQEvent): Promise<void> {
    const io = this.getIO();
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, userId } = eventData;

    // Broadcast to workspace room
    const roomName = `workspace:${workspaceId}`;

    io.to(roomName).emit("workspace:member:left", {
      workspaceId,
      userId,
    });

    logger.info("Broadcasted workspace.member.left", {
      workspaceId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle channel.member.joined event
   * Broadcast to all clients in the channel room
   */
  private async handleChannelMemberJoined(event: RabbitMQEvent): Promise<void> {
    const io = this.getIO();
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, channelId, userId, user } = eventData;

    // Broadcast to channel room
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    io.to(roomName).emit("channel:member:joined", {
      workspaceId,
      channelId,
      userId,
      user,
    });

    logger.info("Broadcasted channel.member.joined", {
      workspaceId,
      channelId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle channel.member.left event
   * Broadcast to all clients in the channel room
   */
  private async handleChannelMemberLeft(event: RabbitMQEvent): Promise<void> {
    const io = this.getIO();
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, channelId, userId } = eventData;

    // Broadcast to channel room
    const roomName = `workspace:${workspaceId}:channel:${channelId}`;

    io.to(roomName).emit("channel:member:left", {
      workspaceId,
      channelId,
      userId,
    });

    logger.info("Broadcasted channel.member.left", {
      workspaceId,
      channelId,
      userId,
      room: roomName,
    });
  }

  /**
   * Handle channel.created event
   * Routes to workspace room for public channels or individual user rooms for private channels
   */
  private async handleChannelCreated(event: RabbitMQEvent): Promise<void> {
    const io = this.getIO();
    // Support both 'payload' and 'data' for compatibility
    const eventData = (event as any).payload || (event as any).data;
    const { workspaceId, isPrivate, members } = eventData;

    if (isPrivate) {
      // Private channel: emit only to specific user rooms
      // This ensures only invited members receive the event
      for (const member of members) {
        const userRoom = `user:${member.userId}`;
        io.to(userRoom).emit("channel:created", eventData);
      }

      logger.info("Broadcasted private channel.created to user rooms", {
        workspaceId,
        channelId: eventData.channelId,
        memberCount: members.length,
        isPrivate: true,
      });
    } else {
      // Public channel: broadcast to workspace room
      // All workspace members will receive the event
      const roomName = `workspace:${workspaceId}`;
      io.to(roomName).emit("channel:created", eventData);

      logger.info("Broadcasted public channel.created to workspace room", {
        workspaceId,
        channelId: eventData.channelId,
        room: roomName,
        memberCount: members.length,
        isPrivate: false,
      });
    }
  }
}
