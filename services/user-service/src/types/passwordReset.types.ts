/**
 * Password Reset related types and interfaces
 *
 * This module defines TypeScript interfaces for password reset
 * operations including tokens, requests, responses, and events.
 */

/**
 * Password Reset Token entity matching Prisma database schema
 */
export type PasswordResetToken = {
  id: string;
  email: string;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
  firstReqTime: Date;
  reqCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Data required to create a new password reset token
 */
export type CreatePasswordResetTokenData = {
  email: string;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
  firstReqTime: Date;
  reqCount?: number;
};

/**
 * Data for updating an existing password reset token
 */
export type UpdatePasswordResetTokenData = {
  tokenId?: string;
  tokenHash?: string;
  expiresAt?: Date;
  firstReqTime?: Date;
  reqCount?: number;
};

// ============================================
// Request/Response Types
// ============================================

/**
 * Request to initiate password reset (forgot password)
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Request to validate a reset token
 */
export interface ValidateResetTokenRequest {
  token: string;
}

/**
 * Response from token validation
 */
export interface ValidateResetTokenResponse {
  valid: boolean;
  email?: string; // Masked email for display (e.g., "j***@example.com")
}

/**
 * Request to reset password with token
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Result of rate limit check
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: "RATE_LIMIT_EXCEEDED";
}

// ============================================
// Event Types
// ============================================

/**
 * Event published when password reset is requested
 * Consumed by notification-service to send email
 */
export interface PasswordResetRequestedEvent {
  eventId: string;
  eventType: "user.password.reset.requested";
  aggregateType: "user";
  aggregateId: string;
  timestamp: string;
  version: "1.0";
  data: {
    email: string;
    resetToken: string; // Plain token for email link
    resetUrl: string;
    expiresAt: string;
  };
  metadata: {
    source: "user-service";
    correlationId?: string;
  };
}

/**
 * Event published after password is successfully reset
 * Consumed by bff-service to logout user sessions
 */
export interface PasswordResetCompletedEvent {
  eventId: string;
  eventType: "user.password.reset";
  aggregateType: "user";
  aggregateId: string;
  timestamp: string;
  version: "1.0";
  data: {
    userId: string;
    email: string;
  };
  metadata: {
    source: "user-service";
    correlationId?: string;
  };
}
