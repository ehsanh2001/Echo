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
  type: "public" | "private" | "direct" | "group_dm";
  createdBy?: string | null;
  memberCount: number;
  settings?: any; // Json type in Prisma, defaults to {}
}

// Create workspace member data (matches Prisma WorkspaceMember fields)
export interface CreateWorkspaceMemberData {
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "guest";
  invitedBy?: string | null;
}

// Create channel member data (matches Prisma ChannelMember fields)
export interface CreateChannelMemberData {
  channelId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedBy?: string | null;
}
