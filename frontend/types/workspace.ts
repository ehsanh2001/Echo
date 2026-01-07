/**
 * Workspace-related TypeScript types
 * Matches backend types from workspace-channel-service
 */

// Enums from backend
export enum WorkspaceRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

export enum ChannelRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

export enum ChannelType {
  PUBLIC = "public",
  PRIVATE = "private",
  DIRECT = "direct",
  GROUP_DM = "group_dm",
}

export interface CreateWorkspaceRequest {
  name: string;
  displayName?: string;
  description?: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  maxMembers: number | null;
  isPublic: boolean;
  vanityUrl: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDetailsResponse extends WorkspaceResponse {
  userRole: WorkspaceRole;
  memberCount: number;
}

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
  lastActivity: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
  // ChannelMember fields for this user
  role: ChannelRole;
  joinedAt: string;
  isMuted: boolean;
  joinedBy: string | null;
}

export interface WorkspaceMembershipResponse extends WorkspaceDetailsResponse {
  channels?: ChannelMembershipResponse[];
}

export interface UserMembershipsResponse {
  workspaces: WorkspaceMembershipResponse[];
}

export interface CheckNameAvailabilityResponse {
  success: boolean;
  data: {
    name: string;
    isAvailable: boolean;
  };
  timestamp: string;
}

export interface CreateWorkspaceResponse {
  success: boolean;
  data: WorkspaceResponse;
  message: string;
  timestamp: string;
}

export interface GetUserMembershipsResponse {
  success: boolean;
  data: UserMembershipsResponse;
  timestamp: string;
}

export interface WorkspaceError {
  success: false;
  message: string;
  code: string;
  statusCode?: number;
  details?: Record<string, any>;
}

// Channel-related types

export interface CreateChannelRequest {
  workspaceId: string;
  name: string;
  displayName?: string;
  description?: string;
  type: ChannelType;
  /** For private channels: user IDs to add as members */
  participants?: string[];
}

export interface ChannelResponse {
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
  lastActivity: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

export interface CheckChannelNameResponse {
  success: boolean;
  data: {
    name: string;
    isAvailable: boolean;
  };
  timestamp: string;
}

export interface CreateChannelResponse {
  success: boolean;
  data: ChannelResponse;
  message: string;
  timestamp: string;
}

/**
 * Response from DELETE /api/workspaces/:workspaceId/channels/:channelId
 */
export interface DeleteChannelResponse {
  success: boolean;
  data: {
    channelId: string;
    workspaceId: string;
    deleted: boolean;
  };
  timestamp: string;
}

/**
 * Response from DELETE /api/workspaces/:workspaceId
 */
export interface DeleteWorkspaceResponse {
  success: boolean;
  message: string;
  data: {
    workspaceId: string;
    workspaceName: string;
  };
  timestamp: string;
}

// ===== WORKSPACE MEMBERS TYPES =====

/**
 * Enriched user information from user-service (cached)
 */
export interface EnrichedUserInfo {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
}

/**
 * Workspace member with enriched user data
 */
export interface WorkspaceMemberWithUser {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  isActive: boolean;
  user: EnrichedUserInfo;
}

/**
 * Channel member with enriched user data
 */
export interface ChannelMemberWithUser {
  userId: string;
  channelId: string;
  role: ChannelRole;
  joinedAt: string;
  isActive: boolean;
  user: EnrichedUserInfo;
}

/**
 * Channel with its members
 */
export interface ChannelWithMembers {
  id: string;
  name: string;
  displayName: string | null;
  type: ChannelType;
  members: ChannelMemberWithUser[];
}

/**
 * Response data for workspace members endpoint
 */
export interface WorkspaceMembersData {
  workspaceId: string;
  workspaceName: string;
  workspaceMembers: WorkspaceMemberWithUser[];
  channels: ChannelWithMembers[];
}

/**
 * API response for workspace members endpoint
 */
export interface GetWorkspaceMembersResponse {
  success: boolean;
  data: WorkspaceMembersData;
  timestamp: string;
}

// ============================================================================
// Socket Event Types
// ============================================================================

/**
 * User info nested in channel.created event members
 */
export interface ChannelCreatedMemberUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  lastSeen: string | null;
}

/**
 * Member data included in channel.created events
 * Note: User info is nested in a 'user' object from the backend
 */
export interface ChannelCreatedMemberData {
  userId: string;
  channelId: string;
  role: string;
  joinedAt: string;
  isActive: boolean;
  user: ChannelCreatedMemberUser;
}

/**
 * Payload for channel.created socket events
 */
export interface ChannelCreatedEventPayload {
  channelId: string;
  channelName: string;
  channelDisplayName: string | null;
  channelDescription: string | null;
  workspaceId: string;
  isPrivate: boolean;
  createdBy: string;
  members: ChannelCreatedMemberData[];
  createdAt: string;
}

/**
 * Payload for channel:deleted socket events
 */
export interface ChannelDeletedEventPayload {
  channelId: string;
  channelName: string;
  workspaceId: string;
  deletedBy: string;
}

/**
 * Payload for workspace:deleted socket events
 */
export interface WorkspaceDeletedEventPayload {
  workspaceId: string;
  workspaceName: string;
  deletedBy: string;
  channelIds: string[]; // List of all channel IDs that were deleted
}
