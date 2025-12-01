import { SendEmailRequest, SendEmailResult } from "../../types/email";

/**
 * Email service interface
 */
export interface IEmailService {
  /**
   * Send an email
   */
  send(request: SendEmailRequest): Promise<SendEmailResult>;
}
