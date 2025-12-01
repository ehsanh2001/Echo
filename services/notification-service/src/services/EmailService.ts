import { injectable } from "tsyringe";
import { Resend } from "resend";
import { IEmailService } from "../interfaces/services/IEmailService";
import { SendEmailRequest, SendEmailResult } from "../types/email";
import { config } from "../config/env";
import { logger } from "../config/logger";

/**
 * Email service using Resend API
 *
 * Features:
 * - Send emails via Resend
 * - Development mode (log only, no actual sending)
 * - Retry logic with exponential backoff
 * - Error handling for rate limits, invalid emails, network errors
 */
@injectable()
export class EmailService implements IEmailService {
  private resend: Resend;
  private readonly isDevelopment: boolean;
  private readonly maxRetries = 3;

  constructor() {
    this.resend = new Resend(config.email.resendApiKey);
    this.isDevelopment = config.nodeEnv === "development";
  }

  /**
   * Send an email with retry logic
   */
  async send(request: SendEmailRequest): Promise<SendEmailResult> {
    // Development mode: just log the email
    if (this.isDevelopment && !config.email.resendApiKey) {
      logger.debug("📧 [DEV MODE] Email would be sent:", {
        to: request.to,
        subject: request.subject,
        from: request.from || {
          email: config.email.fromAddress,
          name: config.email.fromName,
        },
      });
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
      };
    }

    // Production mode: send with retries
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.sendWithResend(request);
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Email send attempt ${attempt}/${this.maxRetries} failed`, {
          to: request.to,
          error: error instanceof Error ? error.message : String(error),
          attempt,
        });

        // Don't retry on permanent failures
        if (this.isPermanentError(error)) {
          logger.error("Permanent email error, not retrying", {
            to: request.to,
            error: error instanceof Error ? error.message : String(error),
          });
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    logger.error("Failed to send email after all retries", {
      to: request.to,
      subject: request.subject,
      attempts: this.maxRetries,
      error: lastError?.message,
    });

    return {
      success: false,
      error: lastError?.message || "Unknown error",
    };
  }

  /**
   * Send email using Resend API
   */
  private async sendWithResend(
    request: SendEmailRequest
  ): Promise<SendEmailResult> {
    try {
      const response = await this.resend.emails.send({
        from: request.from
          ? `${request.from.name} <${request.from.email}>`
          : `${config.email.fromName} <${config.email.fromAddress}>`,
        to: request.to,
        subject: request.subject,
        html: request.html,
      });

      logger.info("✅ Email sent successfully", {
        to: request.to,
        subject: request.subject,
        messageId: response.data?.id,
      });

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error: any) {
      logger.error("Resend API error", {
        to: request.to,
        error: error.message,
        statusCode: error.statusCode,
      });
      throw error;
    }
  }

  /**
   * Check if error is permanent (don't retry)
   */
  private isPermanentError(error: any): boolean {
    const permanentCodes = [400, 401, 403, 404, 422]; // Bad request, unauthorized, forbidden, not found, validation error
    return permanentCodes.includes(error.statusCode);
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
