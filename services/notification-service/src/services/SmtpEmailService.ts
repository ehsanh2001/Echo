import { injectable } from "tsyringe";
import * as nodemailer from "nodemailer";
import { IEmailService } from "../interfaces/services/IEmailService";
import { SendEmailRequest, SendEmailResult } from "../types/email";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * SMTP Email Service (for testing with MailHog)
 *
 * Features:
 * - Send emails via SMTP (MailHog for testing)
 * - Compatible with IEmailService interface
 * - Used in test/development environments
 */
@injectable()
export class SmtpEmailService implements IEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create SMTP transporter for MailHog
    this.transporter = nodemailer.createTransport({
      host: config.email.smtpHost || "localhost",
      port: config.email.smtpPort || 1025,
      secure: false, // MailHog doesn't use TLS
      ignoreTLS: true,
    });

    logger.info("SMTP Email Service initialized", {
      host: config.email.smtpHost || "localhost",
      port: config.email.smtpPort || 1025,
    });
  }

  /**
   * Send an email via SMTP
   */
  async send(request: SendEmailRequest): Promise<SendEmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: request.from
          ? `${request.from.name} <${request.from.email}>`
          : `${config.email.fromName} <${config.email.fromAddress}>`,
        to: request.to,
        subject: request.subject,
        html: request.html,
      });

      logger.info("✅ Email sent successfully via SMTP", {
        to: request.to,
        subject: request.subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error("SMTP send error", {
        to: request.to,
        error: error.message,
      });

      return {
        success: false,
        error: error.message || "Unknown SMTP error",
      };
    }
  }
}
