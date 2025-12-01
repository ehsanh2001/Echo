import axios from "axios";

/**
 * MailHog API Helper
 * Utilities for querying MailHog to retrieve and verify emails during E2E tests
 */

const MAILHOG_API_URL = process.env.MAILHOG_API_URL || "http://localhost:8025";

export interface MailHogMessage {
  ID: string;
  From: {
    Mailbox: string;
    Domain: string;
    Params: string;
  };
  To: Array<{
    Mailbox: string;
    Domain: string;
    Params: string;
  }>;
  Content: {
    Headers: {
      [key: string]: string[];
    };
    Body: string;
    Size: number;
    MIME: null;
  };
  Created: string;
  MIME: null;
  Raw: {
    From: string;
    To: string[];
    Data: string;
    Helo: string;
  };
}

export interface MailHogResponse {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
}

/**
 * Get all emails from MailHog
 */
export async function getAllEmails(): Promise<MailHogMessage[]> {
  try {
    const response = await axios.get<MailHogResponse>(
      `${MAILHOG_API_URL}/api/v2/messages`
    );
    return response.data.items || [];
  } catch (error) {
    console.error("Failed to fetch emails from MailHog:", error);
    return [];
  }
}

/**
 * Get emails sent to a specific recipient
 */
export async function getEmailsTo(email: string): Promise<MailHogMessage[]> {
  const allEmails = await getAllEmails();
  return allEmails.filter((msg) =>
    msg.To.some(
      (to) => `${to.Mailbox}@${to.Domain}`.toLowerCase() === email.toLowerCase()
    )
  );
}

/**
 * Get the most recent email sent to a specific recipient
 */
export async function getLatestEmailTo(
  email: string
): Promise<MailHogMessage | null> {
  const emails = await getEmailsTo(email);
  if (emails.length === 0) {
    return null;
  }
  // MailHog returns newest first
  return emails[0];
}

/**
 * Extract invite token from workspace invite email HTML
 * Looks for the invite URL and extracts the token
 */
export function extractInviteToken(htmlBody: string): string | null {
  // Look for invite URL pattern: /invite/{token} or /invites/accept?token={token}
  // Token is a hex string (a-f0-9)
  const patterns = [
    /\/invite\/([a-f0-9]{40,})/i, // Match hex tokens (at least 40 chars)
    /\/invite\/([a-zA-Z0-9-]+)/,
    /\/invites\/accept\?token=([a-f0-9]{40,})/i,
    /\/invites\/accept\?token=([a-zA-Z0-9-]+)/,
    /token=([a-f0-9]{40,})/i,
    /token=([a-zA-Z0-9-]+)/,
  ];

  for (const pattern of patterns) {
    const match = htmlBody.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Wait for an email to arrive at MailHog
 * Polls MailHog API until email is found or timeout occurs
 */
export async function waitForEmail(
  email: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 1000
): Promise<MailHogMessage | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const latestEmail = await getLatestEmailTo(email);
    if (latestEmail) {
      return latestEmail;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

/**
 * Delete all emails from MailHog
 */
export async function deleteAllEmails(): Promise<void> {
  try {
    await axios.delete(`${MAILHOG_API_URL}/api/v1/messages`);
    console.log("✅ Deleted all emails from MailHog");
  } catch (error) {
    console.error("Failed to delete emails from MailHog:", error);
  }
}

/**
 * Get email subject from MailHog message
 */
export function getEmailSubject(message: MailHogMessage): string {
  const subjectHeader = message.Content.Headers["Subject"];
  if (!subjectHeader || subjectHeader.length === 0) {
    return "";
  }
  return subjectHeader[0];
}

/**
 * Get email body from MailHog message
 */
export function getEmailBody(message: MailHogMessage): string {
  return message.Content.Body;
}
