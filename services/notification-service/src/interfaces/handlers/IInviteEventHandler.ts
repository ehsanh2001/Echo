/**
 * Invite Event Handler Interface
 * Handles workspace and channel invitation events
 */

import { WorkspaceInviteCreatedEvent } from "../../types/events";

export interface IInviteEventHandler {
  /**
   * Handle workspace.invite.created event
   * - Fetch inviter details from user service
   * - Render email template
   * - Send invitation email via Resend
   *
   * @param event - The workspace invite created event
   */
  handleWorkspaceInviteCreated(
    event: WorkspaceInviteCreatedEvent
  ): Promise<void>;
}
