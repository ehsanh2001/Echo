import { injectable, inject } from "tsyringe";
import { IInviteEventHandler } from "../interfaces/handlers/IInviteEventHandler";
import { IEmailService } from "../interfaces/services/IEmailService";
import { ITemplateService } from "../interfaces/services/ITemplateService";
import { IUserServiceClient } from "../interfaces/services/IUserServiceClient";
import { WorkspaceInviteCreatedEvent } from "../types/events";
import { WorkspaceInviteEmailData } from "../types/email";
import { logger } from "../config/logger";

/**
 * Invite Event Handler
 * Processes workspace and channel invitation events
 *
 */
@injectable()
export class InviteEventHandler implements IInviteEventHandler {
  constructor(
    @inject("IEmailService") private readonly emailService: IEmailService,
    @inject("ITemplateService")
    private readonly templateService: ITemplateService,
    @inject("IUserServiceClient")
    private readonly userServiceClient: IUserServiceClient
  ) {}

  /**
   * Handle workspace.invite.created event
   *
   * @param event - The workspace invite created event
   */
  async handleWorkspaceInviteCreated(
    event: WorkspaceInviteCreatedEvent
  ): Promise<void> {
    try {
      logger.info("📧 Processing workspace invite event", {
        eventId: event.eventId,
        inviteId: event.data.inviteId,
        workspaceName: event.data.workspaceName,
        email: event.data.email,
        role: event.data.role,
      });

      // 1. Fetch inviter details from user-service
      const inviter = await this.userServiceClient.getUserById(
        event.data.inviterUserId
      );

      // Use inviter's display name or fallback to "A team member"
      const inviterName = inviter?.displayName || "A team member";

      logger.debug("Inviter details fetched", {
        inviterUserId: event.data.inviterUserId,
        inviterName,
      });

      // 2. Prepare email data
      const emailData: WorkspaceInviteEmailData = {
        email: event.data.email,
        inviterName,
        workspaceName: event.data.workspaceName,
        workspaceDisplayName:
          event.data.workspaceDisplayName || event.data.workspaceName,
        inviteUrl: event.data.inviteUrl,
        role: event.data.role,
        expiresAt: event.data.expiresAt,
        customMessage: event.data.customMessage,
      };

      // 3. Render email template
      const html = await this.templateService.render(
        "workspace-invite",
        emailData
      );

      // 4. Send email
      const result = await this.emailService.send({
        to: event.data.email,
        subject: `${inviterName} invited you to ${event.data.workspaceDisplayName}`,
        html,
      });

      if (result.success) {
        logger.info("✅ Workspace invite email sent successfully", {
          eventId: event.eventId,
          inviteId: event.data.inviteId,
          email: event.data.email,
          messageId: result.messageId,
        });
      } else {
        throw new Error(`Email send failed: ${result.error}`);
      }
    } catch (error) {
      logger.error("❌ Failed to process workspace invite event", {
        eventId: event.eventId,
        inviteId: event.data.inviteId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Re-throw to prevent message acknowledgment (RabbitMQ will retry)
      throw error;
    }
  }
}
