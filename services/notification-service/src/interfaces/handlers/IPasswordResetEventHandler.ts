/**
 * Password Reset Event Handler Interface
 * Handles password reset related events
 */

import { PasswordResetRequestedEvent } from "../../types/events";

export interface IPasswordResetEventHandler {
  /**
   * Handle user.password.reset.requested event
   * - Render password reset email template
   * - Send password reset email
   *
   * @param event - The password reset requested event
   */
  handlePasswordResetRequested(
    event: PasswordResetRequestedEvent
  ): Promise<void>;
}
