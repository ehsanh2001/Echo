/**
 * Socket.IO event type definitions
 * Matches the BFF service Socket.IO implementation
 */

import type { MessageWithAuthorResponse } from "@/types/message";
import type {
  ChannelCreatedEventPayload,
  ChannelDeletedEventPayload,
  WorkspaceDeletedEventPayload,
} from "@/types/workspace";

/**
 * User info included in member events
 */
export interface MemberEventUserInfo {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
}

/**
 * Events sent from client to server
 */
export interface ClientToServerEvents {
  join_workspace: (workspaceId: string) => void;

  leave_workspace: (workspaceId: string) => void;

  join_channel: (data: { workspaceId: string; channelId: string }) => void;

  leave_channel: (data: { workspaceId: string; channelId: string }) => void;
}

/**
 * Events sent from server to client
 */
export interface ServerToClientEvents {
  /**
   * New message created in a channel
   * Emitted to all users in the channel room
   */
  "message:created": (message: MessageWithAuthorResponse) => void;

  /**
   * New member joined a workspace
   * Emitted to all users in the workspace room
   */
  "workspace:member:joined": (data: {
    workspaceId: string;
    userId: string;
    user: MemberEventUserInfo;
  }) => void;

  /**
   * Member left a workspace
   * Emitted to all users in the workspace room
   */
  "workspace:member:left": (data: {
    workspaceId: string;
    userId: string;
  }) => void;

  /**
   * New member joined a channel
   * Emitted to all users in the channel room
   */
  "channel:member:joined": (data: {
    workspaceId: string;
    channelId: string;
    userId: string;
    user: MemberEventUserInfo;
  }) => void;

  /**
   * Member left a channel
   * Emitted to all users in the channel room
   */
  "channel:member:left": (data: {
    workspaceId: string;
    channelId: string;
    userId: string;
  }) => void;

  /**
   * New channel created
   * For public channels: emitted to workspace room
   * For private channels: emitted to each member's user room
   */
  "channel:created": (data: ChannelCreatedEventPayload) => void;

  /**
   * Channel deleted
   * Emitted to all users in the channel room before the room is destroyed
   */
  "channel:deleted": (data: ChannelDeletedEventPayload) => void;

  /**
   * Workspace deleted
   * Emitted to all users in the workspace room before the room is destroyed
   */
  "workspace:deleted": (data: WorkspaceDeletedEventPayload) => void;

  connect: () => void;

  disconnect: (reason: string) => void;

  error: (error: Error) => void;
}

/**
 * Socket.IO connection state
 */
export type SocketConnectionState =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";
