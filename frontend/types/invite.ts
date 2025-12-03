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
