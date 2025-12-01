/**
 * Email-related type definitions
 */

/**
 * Email send request
 */
export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: {
    email: string;
    name: string;
  };
}

/**
 * Email send result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Workspace invite email data
 */
export interface WorkspaceInviteEmailData {
  email: string;
  inviterName: string;
  workspaceName: string;
  workspaceDisplayName: string;
  inviteUrl: string;
  role: "owner" | "admin" | "member" | "guest";
  expiresAt: string | null;
  customMessage?: string;
}

/**
 * User profile data from user-service
 */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  lastSeen: Date | string | null;
  roles: string[];
}

/**
 * User service API response wrapper
 */
export interface UserServiceResponse<T> {
  success: boolean;
  data: T;
}
