import { Server as SocketIOServer } from "socket.io";
import {
  RabbitMQEvent,
  ChannelDeletedEvent,
  WorkspaceDeletedEvent,
  PasswordResetCompletedEvent,
} from "../../types/rabbitmq.types";

/**
 * Base interface for socket event handlers
 * Provides common functionality for broadcasting events via Socket.IO
 */
export interface ISocketEventHandler {
  /**
   * Set the Socket.IO server instance
   * Must be called before handling any events
   */
  setSocketServer(io: SocketIOServer): void;
}

/**
 * Handler for non-critical real-time events
 * These events are ephemeral and can be missed without critical impact
 */
export interface INonCriticalEventHandler extends ISocketEventHandler {
  /**
   * Route and handle a non-critical event
   * Dispatches to appropriate handler based on event type
   */
  handleEvent(event: RabbitMQEvent): Promise<void>;
}

/**
 * Handler for channel deletion events
 * Critical event - must be delivered reliably
 */
export interface IChannelDeletedEventHandler extends ISocketEventHandler {
  /**
   * Handle channel.deleted event
   * Broadcasts deletion notification and removes sockets from channel room
   */
  handleChannelDeleted(event: ChannelDeletedEvent): Promise<void>;
}

/**
 * Handler for workspace deletion events
 * Critical event - must be delivered reliably
 */
export interface IWorkspaceDeletedEventHandler extends ISocketEventHandler {
  /**
   * Handle workspace.deleted event
   * Broadcasts deletion notification and removes sockets from workspace/channel rooms
   */
  handleWorkspaceDeleted(event: WorkspaceDeletedEvent): Promise<void>;
}

/**
 * Handler for password reset events
 * Critical event - must notify all user sessions to log out
 */
export interface IPasswordResetEventHandler extends ISocketEventHandler {
  /**
   * Handle user.password.reset event
   * Emits password:reset event to all user's active sessions
   */
  handlePasswordReset(event: PasswordResetCompletedEvent): Promise<void>;
}
