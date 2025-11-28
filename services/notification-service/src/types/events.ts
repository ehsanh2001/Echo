/**
 * RabbitMQ Event Types for Notification Service
 * Based on workspace-channel-service event structure
 */

/**
 * Workspace Role enum (matches Prisma schema)
 */
export enum WorkspaceRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  GUEST = "guest",
}

/**
 * Base event payload structure
 * All events follow this standardized format
 */
export interface BaseEventPayload<TEventType extends string, TData> {
  eventId: string;
  eventType: TEventType;
  aggregateType: string;
  aggregateId: string;
  timestamp: string; // ISO 8601
  version: string; // "1.0"
  data: TData;
  metadata: {
    source: string;
    correlationId?: string;
    causationId?: string;
  };
}

/**
 * Workspace invite event data
 * Contains all information needed to send an invitation email
 */
export interface WorkspaceInviteEventData {
  inviteId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceDisplayName: string | null;
  email: string;
  role: WorkspaceRole;
  inviterUserId: string;
  inviteToken: string;
  inviteUrl: string;
  expiresAt: string | null; // ISO 8601
  customMessage?: string;
}

/**
 * Workspace invite created event payload
 * Published when a new workspace invitation is created
 * Routing key: workspace.invite.created
 */
export interface WorkspaceInviteCreatedEvent
  extends BaseEventPayload<
    "workspace.invite.created",
    WorkspaceInviteEventData
  > {
  aggregateType: "workspace";
}

/**
 * Union type of all events this service consumes
 * Add more event types as the service grows
 */
export type NotificationEvent = WorkspaceInviteCreatedEvent;
