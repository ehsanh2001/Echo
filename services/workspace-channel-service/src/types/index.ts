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

// ===== USER MEMBERSHIP TYPES =====

// Channel membership response (includes Channel model + ChannelMember data)
export interface ChannelMembershipResponse {
  // Channel model fields
  id: string;
  workspaceId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  type: ChannelType;
  isArchived: boolean;
  isReadOnly: boolean;
  createdBy: string | null;
  memberCount: number;
  lastActivity: Date | null;
  settings: any;
  createdAt: Date;
  updatedAt: Date;
  // ChannelMember fields for this user
  role: ChannelRole;
  joinedAt: Date;
  isMuted: boolean;
  joinedBy: string | null;
}

// Workspace membership response (extends WorkspaceDetailsResponse with optional channels)
export interface WorkspaceMembershipResponse extends WorkspaceDetailsResponse {
  channels?: ChannelMembershipResponse[];
}

// User memberships response (all workspaces user belongs to)
export interface UserMembershipsResponse {
  workspaces: WorkspaceMembershipResponse[];
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

// ===== CHANNEL TYPES =====

// Create channel request (from API layer)
export interface CreateChannelRequest {
  name?: string; // Required for public/private/group_dm, auto-generated for direct
  displayName?: string; // Optional
  description?: string; // Optional
  type: ChannelType; // Required: public, private, direct, group_dm
  participants?: string[]; // Required for 'direct' (exactly 1 other user), optional for others
}

// Create channel response (to API layer)
export interface CreateChannelResponse {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  type: ChannelType;
  createdBy: string;
  memberCount: number;
  isArchived: boolean;
  isReadOnly: boolean;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    userId: string;
    role: ChannelRole;
  }>;
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
    userId?: string;
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
export interface WorkspaceInviteCreatedEventPayload extends BaseEventPayload<
  "workspace.invite.created",
  WorkspaceInviteEventData
> {
  aggregateType: "workspace";
}

// ===== CHANNEL EVENTS (Examples for future) =====

/**
 * Member data included in channel.created event
 * Contains full user info needed for frontend cache updates
 */
export interface ChannelCreatedMemberData {
  userId: string;
  channelId: string;
  role: ChannelRole;
  joinedAt: string; // ISO 8601
  isActive: boolean;
  user: EnrichedUserInfo;
}

/**
 * Channel created event data
 * Enhanced to include full member data for efficient cache updates
 */
export interface ChannelCreatedEventData {
  channelId: string;
  workspaceId: string;
  channelName: string;
  channelDisplayName: string | null;
  channelDescription: string | null;
  channelType: ChannelType;
  createdBy: string;
  memberCount: number;
  /** Whether this is a private channel (for BFF routing decision) */
  isPrivate: boolean;
  /** Full member data including user info for frontend cache */
  members: ChannelCreatedMemberData[];
  /** Channel creation timestamp */
  createdAt: string; // ISO 8601
}

// Channel created event payload
export interface ChannelCreatedEventPayload extends BaseEventPayload<
  "channel.created",
  ChannelCreatedEventData
> {
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
export interface ChannelMemberAddedEventPayload extends BaseEventPayload<
  "channel.member.added",
  ChannelMemberAddedEventData
> {
  aggregateType: "channel";
}

// ===== WORKSPACE MEMBER EVENTS =====

// Member event types
export type MemberEventType =
  | "workspace.member.joined"
  | "workspace.member.left"
  | "channel.member.joined"
  | "channel.member.left";

// Workspace member joined event data
export interface WorkspaceMemberJoinedEventData {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  role: WorkspaceRole;
  user: EnrichedUserInfo;
  inviteId?: string;
}

// Workspace member joined event payload
export interface WorkspaceMemberJoinedEventPayload extends BaseEventPayload<
  "workspace.member.joined",
  WorkspaceMemberJoinedEventData
> {
  aggregateType: "workspace";
}

// Workspace member left event data
export interface WorkspaceMemberLeftEventData {
  workspaceId: string;
  workspaceName: string;
  userId: string;
}

// Workspace member left event payload
export interface WorkspaceMemberLeftEventPayload extends BaseEventPayload<
  "workspace.member.left",
  WorkspaceMemberLeftEventData
> {
  aggregateType: "workspace";
}

// Channel member joined event data
export interface ChannelMemberJoinedEventData {
  channelId: string;
  channelName: string;
  workspaceId: string;
  userId: string;
  role: ChannelRole;
  user: EnrichedUserInfo;
}

// Channel member joined event payload
export interface ChannelMemberJoinedEventPayload extends BaseEventPayload<
  "channel.member.joined",
  ChannelMemberJoinedEventData
> {
  aggregateType: "channel";
}

// Channel member left event data
export interface ChannelMemberLeftEventData {
  channelId: string;
  channelName: string;
  workspaceId: string;
  userId: string;
}

// Channel member left event payload
export interface ChannelMemberLeftEventPayload extends BaseEventPayload<
  "channel.member.left",
  ChannelMemberLeftEventData
> {
  aggregateType: "channel";
}

// ===== UNION TYPES FOR TYPE SAFETY =====

// All event types in this service
export type ServiceEventType =
  | "workspace.invite.created"
  | "channel.created"
  | "channel.member.added"
  | MemberEventType;

// All aggregate types in this service
export type AggregateType = "workspace" | "channel" | "user" | "message";

// Union of all event payloads for type safety
export type EventPayload =
  | WorkspaceInviteCreatedEventPayload
  | ChannelCreatedEventPayload
  | ChannelMemberAddedEventPayload
  | WorkspaceMemberJoinedEventPayload
  | WorkspaceMemberLeftEventPayload
  | ChannelMemberJoinedEventPayload
  | ChannelMemberLeftEventPayload;

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

// ===== WORKSPACE & CHANNEL MEMBERS TYPES =====

// Enriched user info (cached from user-service)
export interface EnrichedUserInfo {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
}

// Raw workspace member data (from repository, before user enrichment)
export interface WorkspaceMemberData {
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
  isActive: boolean;
}

// Raw channel member data (from repository, before user enrichment)
export interface ChannelMemberData {
  userId: string;
  role: ChannelRole;
  joinedAt: Date;
  isActive: boolean;
}

// Channel with raw member data (from repository)
export interface ChannelWithMembersData {
  channelId: string;
  channelName: string;
  channelDisplayName: string | null;
  channelType: ChannelType;
  members: ChannelMemberData[];
}

// Workspace member with enriched user data (for API responses)
export interface WorkspaceMemberWithUserInfo {
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
  isActive: boolean;
  user: EnrichedUserInfo;
}

// Channel member with enriched user data (for API responses)
export interface ChannelMemberWithUserInfo {
  userId: string;
  channelId: string;
  role: ChannelRole;
  joinedAt: Date;
  isActive: boolean;
  user: EnrichedUserInfo;
}

// Channel with its members (for API responses)
export interface ChannelWithMembers {
  id: string;
  name: string;
  displayName: string | null;
  type: ChannelType;
  members: ChannelMemberWithUserInfo[];
}

// Response for workspace members endpoint
export interface WorkspaceMembersResponse {
  workspaceId: string;
  workspaceName: string;
  workspaceMembers: WorkspaceMemberWithUserInfo[];
  channels: ChannelWithMembers[];
}
