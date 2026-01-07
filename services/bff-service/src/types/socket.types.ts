/**
 * Socket.IO Event Types for BFF Service
 *
 * Defines the structure of events emitted from server to clients.
 */

/**
 * Channel deleted event payload
 * Emitted when a channel is deleted by a workspace admin/owner
 */
export interface ChannelDeletedPayload {
  channelId: string;
  workspaceId: string;
  channelName: string;
  deletedBy: string; // userId who deleted the channel
}

/**
 * Workspace deleted event payload
 * Emitted when a workspace is deleted by the workspace owner
 */
export interface WorkspaceDeletedPayload {
  workspaceId: string;
  workspaceName: string;
  deletedBy: string; // userId who deleted the workspace
  channelIds: string[]; // List of all channel IDs that were deleted
}

/**
 * Server to Client Events
 * Events emitted from the server to connected clients
 */
export interface ServerToClientEvents {
  // Channel events
  "channel:deleted": (payload: ChannelDeletedPayload) => void;

  // Workspace events
  "workspace:deleted": (payload: WorkspaceDeletedPayload) => void;

  // Message events (to be added as needed)
  // "message:created": (payload: MessageCreatedPayload) => void;
  // "message:updated": (payload: MessageUpdatedPayload) => void;
  // "message:deleted": (payload: MessageDeletedPayload) => void;
}

/**
 * Client to Server Events
 * Events emitted from clients to the server
 */
export interface ClientToServerEvents {
  // Room management
  joinWorkspace: (workspaceId: string) => void;
  leaveWorkspace: (workspaceId: string) => void;
  joinChannel: (workspaceId: string, channelId: string) => void;
  leaveChannel: (workspaceId: string, channelId: string) => void;
}
