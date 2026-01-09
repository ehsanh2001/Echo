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
 * Workspace member joined event (from workspace-channel service)
 */
export interface WorkspaceMemberJoinedEvent {
  type: "workspace.member.joined";
  payload: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    role: "admin" | "member";
    user: MemberEventUserInfo;
    inviteId?: string;
  };
  timestamp: string;
}

/**
 * Workspace member left event (from workspace-channel service)
 */
export interface WorkspaceMemberLeftEvent {
  type: "workspace.member.left";
  payload: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
  };
  timestamp: string;
}

/**
 * Channel member joined event (from workspace-channel service)
 */
export interface ChannelMemberJoinedEvent {
  type: "channel.member.joined";
  payload: {
    channelId: string;
    channelName: string;
    workspaceId: string;
    userId: string;
    role: "admin" | "member";
    user: MemberEventUserInfo;
  };
  timestamp: string;
}

/**
 * Channel member left event (from workspace-channel service)
 */
export interface ChannelMemberLeftEvent {
  type: "channel.member.left";
  payload: {
    channelId: string;
    channelName: string;
    workspaceId: string;
    userId: string;
  };
  timestamp: string;
}

/**
 * Common event metadata structure for outbox pattern events
 */
export interface OutboxEventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  traceId?: string;
}

/**
 * Base interface for outbox pattern events
 */
export interface BaseOutboxEvent {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  timestamp: string;
  version: string;
  metadata: OutboxEventMetadata;
}

/**
 * Channel deleted event (from workspace-channel service via outbox pattern)
 * Emitted when a channel is permanently deleted
 * Note: This uses different structure (eventType, data) than other events (type, payload)
 * because it comes from the transactional outbox pattern
 */
export interface ChannelDeletedEvent extends BaseOutboxEvent {
  eventType: "channel.deleted";
  aggregateType: "channel";
  data: {
    channelId: string;
    workspaceId: string;
    channelName: string;
    deletedBy: string;
  };
}

/**
 * Workspace deleted event (from workspace-channel service via outbox pattern)
 * Emitted when a workspace is permanently deleted
 */
export interface WorkspaceDeletedEvent extends BaseOutboxEvent {
  eventType: "workspace.deleted";
  aggregateType: "workspace";
  data: {
    workspaceId: string;
    workspaceName: string;
    deletedBy: string;
    channelIds: string[];
  };
}

/**
 * Password reset completed event (from user-service via outbox pattern)
 * Emitted when a user successfully resets their password
 * Used to notify all active sessions to log out
 */
export interface PasswordResetCompletedEvent extends BaseOutboxEvent {
  eventType: "user.password.reset";
  aggregateType: "user";
  data: {
    userId: string;
    email: string;
  };
}

/**
 * Union type of events consumed from the non-critical queue
 * Note: ChannelDeletedEvent and WorkspaceDeletedEvent are handled separately via the critical queue
 */
export type RabbitMQEvent =
  | MessageCreatedEvent
  | WorkspaceCreatedEvent
  | ChannelCreatedEvent
  | MemberJoinedWorkspaceEvent
  | WorkspaceMemberJoinedEvent
  | WorkspaceMemberLeftEvent
  | ChannelMemberJoinedEvent
  | ChannelMemberLeftEvent;
