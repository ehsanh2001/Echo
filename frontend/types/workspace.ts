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
