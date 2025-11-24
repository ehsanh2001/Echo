/**
 * Socket.IO event type definitions
 * Matches the BFF service Socket.IO implementation
 */

import type { MessageWithAuthorResponse } from "@/types/message";

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
