/**
 * Invite-related TypeScript types
 * Matches backend types from workspace-channel-service
 */

export type InviteRole = "member" | "admin" | "guest";

export interface CreateInviteRequest {
  email: string;
  role?: InviteRole;
  expiresInDays?: number;
  customMessage?: string;
}

export interface CreateInviteResponse {
  success: boolean;
  data: {
    inviteId: string;
    email: string;
    workspaceId: string;
    role: InviteRole;
    inviteUrl: string;
    expiresAt: string;
    customMessage: string | null;
    createdAt: string;
    createdBy: string;
  };
  message: string;
  timestamp: string;
}

export interface InviteError {
  success: false;
  message: string;
  code: string;
  statusCode?: number;
  details?: Record<string, any>;
}

export interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  data: {
    workspace: {
      id: string;
      name: string;
      displayName: string;
      description: string;
      ownerId: string;
      isArchived: boolean;
      createdAt: string;
      updatedAt: string;
    };
    channels: Array<{
      id: string;
      name: string;
      displayName: string;
      description: string;
      type: "public";
      isArchived: boolean;
    }>;
  };
  message: string;
  timestamp: string;
}
