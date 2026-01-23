import { injectable } from "tsyringe";
import * as nodemailer from "nodemailer";
import { IEmailService } from "../interfaces/services/IEmailService";
import { SendEmailRequest, SendEmailResult } from "../types/email";
import { config, EmailServiceName } from "../config/env";
import logger from "../utils/logger";

/**
 * SMTP Email Service
 *
 * Supports multiple email providers via SMTP:
 * - MailHog: For local development/testing (no auth, no TLS)
 * - Gmail: For production (with app password authentication)
 *
 * Features:
 * - Send emails via SMTP
 * - Compatible with IEmailService interface
 * - Provider selection via EMAIL_SERVICE_NAME env var
 */
@injectable()
export class SmtpEmailService implements IEmailService {
  private transporter: nodemailer.Transporter;
  private readonly serviceName: EmailServiceName;
  private readonly fromAddress: string;

  constructor() {
    this.serviceName = config.email.serviceName;
    this.transporter = this.createTransporter();
    this.fromAddress = this.getFromAddress();

    logger.info(`📧 SMTP Email Service initialized with ${this.serviceName}`, {
      serviceName: this.serviceName,
      fromAddress: this.fromAddress,
    });
  }

  /**
   * Create the appropriate nodemailer transporter based on service name
   */
  private createTransporter(): nodemailer.Transporter {
    switch (this.serviceName) {
      case "Gmail":
        return this.createGmailTransporter();
      case "MailHog":
      default:
        return this.createMailHogTransporter();
    }
  }

  /**
   * Create Gmail SMTP transporter
   * Uses Gmail's SMTP server with app password authentication
   */
  private createGmailTransporter(): nodemailer.Transporter {
    const { user, appPassword } = config.email.gmail;

    if (!user || !appPassword) {
      throw new Error(
        "❌ Gmail configuration missing: GMAIL_USER and GMAIL_APP_PASSWORD are required",
      );
    }

    logger.info("Creating Gmail transporter", { user });

    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user,
        pass: appPassword,
      },
    });
  }

  /**
   * Create MailHog SMTP transporter
   * Used for local development/testing - no auth required
   */
  private createMailHogTransporter(): nodemailer.Transporter {
    const { host, port } = config.email.mailhog;

    logger.info("Creating MailHog transporter", { host, port });

    return nodemailer.createTransport({
      host,
      port,
      secure: false, // MailHog doesn't use TLS
      ignoreTLS: true,
    });
  }

  /**
   * Get the "from" address based on service type
   */
  private getFromAddress(): string {
    if (this.serviceName === "Gmail") {
      return config.email.gmail.user;
    }
    // For MailHog, use a placeholder address
    return "noreply@echo.local";
  }

  /**
   * Send an email via SMTP
   */
  async send(request: SendEmailRequest): Promise<SendEmailResult> {
    try {
      const fromName = request.from?.name || config.email.fromName;
      const fromEmail = request.from?.email || this.fromAddress;

      const info = await this.transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: request.to,
        subject: request.subject,
        html: request.html,
      });

      logger.info(`✅ Email sent successfully via ${this.serviceName}`, {
        to: request.to,
        subject: request.subject,
        messageId: info.messageId,
        serviceName: this.serviceName,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`❌ ${this.serviceName} send error`, {
        to: request.to,
        error: error.message,
        serviceName: this.serviceName,
      });

      return {
        success: false,
        error: error.message || `Unknown ${this.serviceName} SMTP error`,
      };
    }
  }
}
