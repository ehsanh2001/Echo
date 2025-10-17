import crypto from "crypto";
import { config } from "../config/env";

/**
 * Utility functions for token generation and validation
 */
export class TokenUtils {
  /**
   * Generate a cryptographically secure random token for invites
   * Uses config.invites.tokenLength (64 hex digits = 32 bytes) for security
   * @returns A hex-encoded token string
   */
  static generateSecureToken(): string {
    const lengthInBytes = config.invites.tokenLength / 2; // 64 hex digits = 32 bytes
    return crypto.randomBytes(lengthInBytes).toString("hex");
  }

  /**
   * Validate token format (hex string of configured length)
   * @param token - The token to validate
   * @returns True if token format is valid
   */
  static isValidTokenFormat(token: string): boolean {
    if (
      typeof token !== "string" ||
      token.length !== config.invites.tokenLength
    ) {
      return false;
    }

    // Check if it's a valid hex string
    const hexRegex = /^[0-9a-f]+$/i;
    return hexRegex.test(token);
  }
}

/**
 * Utility functions for URL generation
 */
export class UrlUtils {
  /**
   * Generate an invite URL using the configured frontend base URL
   * @param token - The invite token
   * @returns The complete invite URL
   */
  static generateInviteUrl(token: string): string {
    // Remove trailing slash if present
    const cleanBaseUrl = config.frontend.baseUrl.replace(/\/$/, "");
    return `${cleanBaseUrl}/invites/${token}`;
  }
}

/**
 * Utility functions for date operations
 */
export class DateUtils {
  /**
   * Calculate expiration date from days
   * @param days - Number of days from now
   * @returns Date object representing the expiration time
   */
  static calculateExpirationDate(days: number): Date {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return expirationDate;
  }

  /**
   * Check if a date is expired (in the past)
   * @param date - The date to check (can be null)
   * @returns True if date is in the past or null
   */
  static isExpired(date: Date | null): boolean {
    if (!date) return false; // No expiration date means never expires
    return new Date() > date;
  }

  /**
   * Convert date to ISO string, handling null values
   * @param date - The date to convert
   * @returns ISO string or null
   */
  static toISOStringOrNull(date: Date | null): string | null {
    return date ? date.toISOString() : null;
  }
}
