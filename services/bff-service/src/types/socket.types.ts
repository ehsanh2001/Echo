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
 * Read receipt updated event payload
 * Emitted when a user's read position is updated in a channel
 * Sent only to the user who updated their read position
 */
export interface ReadReceiptUpdatedPayload {
  workspaceId: string;
  channelId: string;
  userId: string;
  lastReadMessageNo: number;
  lastReadMessageId: string | null;
  lastReadAt: string; // ISO-8601
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

  // Read receipt events
  "read-receipt:updated": (payload: ReadReceiptUpdatedPayload) => void;

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
