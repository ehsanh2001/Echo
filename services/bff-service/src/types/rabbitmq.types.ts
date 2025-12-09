/**
 * RabbitMQ Event Types
 * Events consumed by BFF service from multiple exchanges
 */

/**
 * Message Service Events (from 'message' exchange)
 */
export interface MessageCreatedEvent {
  type: "message.created";
  payload: {
    id: string;
    workspaceId: string;
    channelId: string;
    messageNo: number;
    userId: string;
    content: string;
    contentType: string;
    isEdited: boolean;
    editCount: number;
    deliveryStatus: string;
    parentMessageId: string | null;
    threadRootId: string | null;
    threadDepth: number;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    clientMessageCorrelationId: string; // Required: client-generated correlation ID
  };
  timestamp: string;
  metadata: {
    timestamp: string;
    service: string;
    version: string;
    correlationId?: string;
    userId?: string;
  };
}

/**
 * Workspace-Channel Service Events (from 'workspace_channel' exchange)
 */
export interface WorkspaceCreatedEvent {
  type: "workspace.created";
  payload: {
    id: string;
    name: string;
    handle: string;
    ownerId: string;
    createdAt: Date;
  };
  timestamp: string;
}

export interface ChannelCreatedEvent {
  type: "channel.created";
  payload: {
    id: string;
    workspaceId: string;
    name: string;
    type: "public" | "private" | "direct" | "group_dm";
    description: string | null;
    createdBy: string;
    createdAt: Date;
  };
  timestamp: string;
}

export interface MemberJoinedWorkspaceEvent {
  type: "member.joined.workspace";
  payload: {
    workspaceId: string;
    userId: string;
    role: string;
    joinedAt: Date;
  };
  timestamp: string;
}

/**
 * Union type of all events BFF consumes
 */
export type RabbitMQEvent =
  | MessageCreatedEvent
  | WorkspaceCreatedEvent
  | ChannelCreatedEvent
  | MemberJoinedWorkspaceEvent;
