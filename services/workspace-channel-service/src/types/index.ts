/**
 * Common types and interfaces for workspace-channel-service
 */

// Re-export Prisma enums for convenience
export {
  WorkspaceRole,
  ChannelRole,
  ChannelType,
  InviteType,
} from "@prisma/client";

// Import for local use in type definitions
import type {
  WorkspaceRole,
  ChannelRole,
  ChannelType,
  InviteType,
} from "@prisma/client";

// ===== JWT & AUTH TYPES =====

// JWT Token payload structure (must match user-service)
export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

// Create workspace request
export interface CreateWorkspaceRequest {
  name: string;
  displayName?: string;
  description?: string;
}

// Workspace response (matches Prisma Workspace model)
export interface WorkspaceResponse {
  id: string;
  name: string;
  displayName: string | null; // Optional in Prisma schema
  description: string | null; // Optional in Prisma schema
  ownerId: string;
  isArchived: boolean;
  maxMembers: number | null; // Optional in Prisma schema
  isPublic: boolean;
  vanityUrl: string | null; // Optional in Prisma schema
  settings: any; // Json type in Prisma (use any or JsonValue for compatibility)
  createdAt: Date;
  updatedAt: Date;
}

// Workspace details response (extends WorkspaceResponse with user's membership info)
export interface WorkspaceDetailsResponse extends WorkspaceResponse {
  userRole: WorkspaceRole; // User's role in this workspace
  memberCount: number; // Total number of active members
}

// User info from user-service (matches UserProfile from user-service)
export interface UserInfo {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  lastSeen: Date | null;
  roles: string[];
}

// Service error structure (similar to user-service)
export interface ServiceErrorDetails {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

// Validation error structure
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Create workspace data for repository (matches Prisma Workspace fields)
// Optional fields use ? and default to null when passed to Prisma
export interface CreateWorkspaceData {
  name: string;
  displayName?: string | null;
  description?: string | null;
  ownerId: string;
  settings?: any; // Json type in Prisma, defaults to {}
}

// Create channel data for repository (matches Prisma Channel fields)
// Optional fields use ? and default to null when passed to Prisma
export interface CreateChannelData {
  workspaceId: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  type: ChannelType;
  createdBy?: string | null;
  memberCount: number;
  settings?: any; // Json type in Prisma, defaults to {}
}

// Create workspace member data (matches Prisma WorkspaceMember fields)
export interface CreateWorkspaceMemberData {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedBy?: string | null;
}

// Create channel member data (matches Prisma ChannelMember fields)
export interface CreateChannelMemberData {
  channelId: string;
  userId: string;
  role: ChannelRole;
  joinedBy?: string | null;
}

// ===== INVITE TYPES =====

// Create workspace invite request
export interface CreateWorkspaceInviteRequest {
  email: string;
  role?: WorkspaceRole; // Optional, defaults to 'member'
  expiresInDays?: number; // Optional, defaults to 7
  customMessage?: string; // Optional personal message from inviter
}

// Create workspace invite data for repository (matches Prisma Invite fields)
export interface CreateWorkspaceInviteData {
  workspaceId: string;
  inviterId: string;
  email: string;
  inviteToken: string;
  type: InviteType;
  role: WorkspaceRole;
  expiresAt?: Date | null;
  metadata?: any; // Json type in Prisma, defaults to {}
}

// Workspace invite response
export interface WorkspaceInviteResponse {
  inviteId: string;
  email: string;
  workspaceId: string;
  inviteUrl: string;
  role: WorkspaceRole;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date | null;
}

// ===== OUTBOX EVENT TYPES =====

// Generic outbox event data for repository (matches Prisma OutboxEvent fields)
// This is the low-level structure that goes into the database
export interface CreateOutboxEventData {
  workspaceId?: string | null; // Optional: for workspace-level events
  channelId?: string | null; // Optional: for channel-level events
  aggregateType: string; // "workspace" | "channel" | "user" | "message" etc.
  aggregateId: string | null; // ID of the aggregate root
  eventType: string; // Specific event type like "workspace.invite.created"
  payload: any; // Json type in Prisma - the full event payload
}

// ===== EVENT PAYLOAD BASE STRUCTURE =====

// Base structure for all event payloads
export interface BaseEventPayload<TEventType extends string, TData> {
  eventId: string;
  eventType: TEventType;
  aggregateType: string;
  aggregateId: string;
  timestamp: string; // ISO 8601
  version: string; // "1.0"
  data: TData;
  metadata: {
    source: "workspace-channel-service";
    correlationId?: string;
    causationId?: string;
  };
}

// ===== WORKSPACE INVITE EVENTS =====

// Input data for creating a workspace invite event
export interface CreateInviteEventData {
  inviteId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceDisplayName: string | null;
  email: string;
  role: WorkspaceRole;
  inviterUserId: string;
  inviteToken: string;
  inviteUrl: string;
  expiresAt: string | null;
  customMessage?: string;
}

// Workspace invite event data (used inside payload)
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

// Workspace invite created event payload (complete structure)
export interface WorkspaceInviteCreatedEventPayload
  extends BaseEventPayload<
    "workspace.invite.created",
    WorkspaceInviteEventData
  > {
  aggregateType: "workspace";
}

// ===== CHANNEL EVENTS (Examples for future) =====

// Channel created event data
export interface ChannelCreatedEventData {
  channelId: string;
  workspaceId: string;
  channelName: string;
  channelDisplayName: string | null;
  channelType: ChannelType;
  createdBy: string;
  memberCount: number;
}

// Channel created event payload
export interface ChannelCreatedEventPayload
  extends BaseEventPayload<"channel.created", ChannelCreatedEventData> {
  aggregateType: "channel";
}

// Channel member added event data
export interface ChannelMemberAddedEventData {
  channelId: string;
  workspaceId: string;
  channelName: string;
  userId: string;
  role: ChannelRole;
  addedBy: string;
}

// Channel member added event payload
export interface ChannelMemberAddedEventPayload
  extends BaseEventPayload<
    "channel.member.added",
    ChannelMemberAddedEventData
  > {
  aggregateType: "channel";
}

// ===== UNION TYPES FOR TYPE SAFETY =====

// All event types in this service
export type ServiceEventType =
  | "workspace.invite.created"
  | "channel.created"
  | "channel.member.added";
// Add more as needed

// All aggregate types in this service
export type AggregateType = "workspace" | "channel" | "user" | "message";

// Union of all event payloads for type safety
export type EventPayload =
  | WorkspaceInviteCreatedEventPayload
  | ChannelCreatedEventPayload
  | ChannelMemberAddedEventPayload;
// Add more as needed

// ===== INVITE ACCEPTANCE TYPES =====

// Accept invite request
export interface AcceptInviteRequest {
  token: string;
}

// Channel info in accept invite response
export interface AcceptInviteChannelInfo {
  id: string;
  name: string;
  displayName: string | null;
}

// Workspace info in accept invite response
export interface AcceptInviteWorkspaceInfo {
  id: string;
  name: string;
  displayName: string | null;
}

// Accept invite response
export interface AcceptInviteResponse {
  message: string;
  workspace: AcceptInviteWorkspaceInfo;
  channels: AcceptInviteChannelInfo[];
}
