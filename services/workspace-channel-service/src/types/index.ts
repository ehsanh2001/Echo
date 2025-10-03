/**
 * Common types and interfaces for workspace-channel-service
 */

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

// Workspace response
export interface WorkspaceResponse {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  ownerId: string;
  isArchived: boolean;
  maxMembers?: number;
  isPublic: boolean;
  vanityUrl?: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
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

// Create workspace data for repository
export interface CreateWorkspaceData {
  name: string;
  displayName: string;
  description?: string;
  ownerId: string;
  settings?: Record<string, any>;
}

// Create channel data for repository
export interface CreateChannelData {
  workspaceId: string;
  name: string;
  displayName?: string;
  description?: string;
  type: "public" | "private" | "direct" | "group_dm";
  createdBy: string;
  memberCount: number;
  settings?: Record<string, any>;
}

// Create workspace member data
export interface CreateWorkspaceMemberData {
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "guest";
  invitedBy?: string;
}

// Create channel member data
export interface CreateChannelMemberData {
  channelId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedBy?: string;
}
