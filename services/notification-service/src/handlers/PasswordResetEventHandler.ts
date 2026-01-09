import { injectable, inject } from "tsyringe";
import { IPasswordResetEventHandler } from "../interfaces/handlers/IPasswordResetEventHandler";
import { IEmailService } from "../interfaces/services/IEmailService";
import { ITemplateService } from "../interfaces/services/ITemplateService";
import { PasswordResetRequestedEvent } from "../types/events";
import logger from "../utils/logger";

/**
 * Password Reset Event Handler
 * Processes password reset events and sends reset emails
 */
@injectable()
export class PasswordResetEventHandler implements IPasswordResetEventHandler {
  constructor(
    @inject("IEmailService") private readonly emailService: IEmailService,
    @inject("ITemplateService")
    private readonly templateService: ITemplateService
  ) {}

  /**
   * Handle user.password.reset.requested event
   *
   * @param event - The password reset requested event
   */
  async handlePasswordResetRequested(
    event: PasswordResetRequestedEvent
  ): Promise<void> {
    try {
      logger.info("📧 Processing password reset event", {
        eventId: event.eventId,
        email: this.maskEmail(event.data.email),
      });

      const { email, resetUrl, expiresAt } = event.data;

      // Calculate expiration time in minutes
      const expiresDate = new Date(expiresAt);
      const expiresInMinutes = Math.max(
        1,
        Math.round((expiresDate.getTime() - Date.now()) / 60000)
      );

      // Render email template
      const html = await this.templateService.render("password-reset", {
        resetUrl,
        expiresInMinutes,
      });

      // Send email
      const result = await this.emailService.send({
        to: email,
        subject: "Reset your Echo password",
        html,
      });

      if (result.success) {
        logger.info("✅ Password reset email sent successfully", {
          eventId: event.eventId,
          email: this.maskEmail(email),
          messageId: result.messageId,
        });
      } else {
        throw new Error(`Email send failed: ${result.error}`);
      }
    } catch (error) {
      logger.error("❌ Failed to process password reset event", {
        eventId: event.eventId,
        email: this.maskEmail(event.data.email),
        error: error instanceof Error ? error.message : String(error),
      });
      // Re-throw to prevent message acknowledgment (RabbitMQ will handle via DLX)
      throw error;
    }
  }

  /**
   * Mask email for logging (privacy protection)
   */
  private maskEmail(email: string): string {
    const atIndex = email.indexOf("@");
    if (atIndex <= 0) return "***";
    const local = email.substring(0, atIndex);
    const domain = email.substring(atIndex + 1);
    const maskedLocal = local.charAt(0) + "***";
    return `${maskedLocal}@${domain}`;
  }
}
