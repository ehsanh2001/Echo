import { ValidateResetTokenResponse } from "../../types/passwordReset.types";

/**
 * Password Reset Service interface
 *
 * Defines the contract for password reset operations including
 * requesting reset, validating tokens, and resetting passwords.
 */
export interface IPasswordResetService {
  /**
   * Requests a password reset for the given email
   *
   * This method always returns successfully regardless of whether the email exists.
   * This prevents email enumeration attacks.
   *
   * @param email - Email address to send reset link to
   * @returns Promise that resolves when the request is processed
   */
  requestPasswordReset(email: string): Promise<void>;

  /**
   * Validates a password reset token
   *
   * Checks if the token is valid and not expired.
   * If expired, the token record is deleted.
   *
   * @param token - The full token (tokenId.tokenSecret format)
   * @returns Promise resolving to validation result with masked email if valid
   */
  validateToken(token: string): Promise<ValidateResetTokenResponse>;

  /**
   * Resets the user's password using a valid token
   *
   * If successful, invalidates all user sessions and publishes
   * a password reset event for socket-based logout.
   *
   * @param token - The full token (tokenId.tokenSecret format)
   * @param newPassword - The new password to set
   * @returns Promise that resolves when password is reset
   * @throws {UserServiceError} When token is invalid or user not found
   */
  resetPassword(token: string, newPassword: string): Promise<void>;
}
