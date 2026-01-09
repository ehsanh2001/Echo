import "reflect-metadata";
import { injectable } from "tsyringe";
import { prisma } from "../config/prisma";
import logger from "../utils/logger";
import {
  PasswordResetToken,
  CreatePasswordResetTokenData,
  UpdatePasswordResetTokenData,
} from "../types/passwordReset.types";
import { IPasswordResetRepository } from "../interfaces/repositories/IPasswordResetRepository";

/**
 * Prisma-based implementation of the Password Reset Repository
 *
 * Provides concrete implementation of password reset token data access
 * operations using Prisma ORM. This class is injectable and can be used
 * with dependency injection container.
 *
 * Features:
 * - CRUD operations for password reset tokens
 * - Rate limiting support through token record updates
 * - Expired token cleanup
 */
@injectable()
export class PasswordResetRepository implements IPasswordResetRepository {
  /**
   * Finds a password reset token by email
   *
   * @param email - Email address to search for
   * @returns Promise resolving to token if found, null otherwise
   */
  async findByEmail(email: string): Promise<PasswordResetToken | null> {
    try {
      logger.debug("Finding password reset token by email", {
        email: this.maskEmail(email),
      });

      return await prisma.passwordResetToken.findUnique({
        where: { email },
      });
    } catch (error) {
      logger.error("Error finding password reset token", { error });
      throw new Error(
        `Failed to find password reset token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Creates a new password reset token
   *
   * @param data - Token data for creation
   * @returns Promise resolving to the created token entity
   */
  async create(
    data: CreatePasswordResetTokenData
  ): Promise<PasswordResetToken> {
    try {
      logger.debug("Creating password reset token", {
        email: this.maskEmail(data.email),
      });

      return await prisma.passwordResetToken.create({
        data: {
          email: data.email,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          firstReqTime: data.firstReqTime,
          reqCount: data.reqCount ?? 1,
        },
      });
    } catch (error) {
      logger.error("Error creating password reset token", { error });
      throw new Error(
        `Failed to create password reset token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Updates an existing password reset token
   *
   * @param email - Email address of the token to update
   * @param data - Data to update
   * @returns Promise resolving to the updated token entity
   */
  async update(
    email: string,
    data: UpdatePasswordResetTokenData
  ): Promise<PasswordResetToken> {
    try {
      logger.debug("Updating password reset token", {
        email: this.maskEmail(email),
      });

      return await prisma.passwordResetToken.update({
        where: { email },
        data,
      });
    } catch (error) {
      logger.error("Error updating password reset token", { error });
      throw new Error(
        `Failed to update password reset token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Deletes a password reset token by email
   *
   * @param email - Email address of the token to delete
   */
  async deleteByEmail(email: string): Promise<void> {
    try {
      logger.debug("Deleting password reset token", {
        email: this.maskEmail(email),
      });

      await prisma.passwordResetToken.delete({
        where: { email },
      });
    } catch (error) {
      // If record not found, that's okay - it's already deleted
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        logger.debug("Password reset token already deleted or not found");
        return;
      }

      logger.error("Error deleting password reset token", { error });
      throw new Error(
        `Failed to delete password reset token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Deletes all expired password reset tokens
   *
   * @returns Promise resolving to the number of deleted tokens
   */
  async deleteExpired(): Promise<number> {
    try {
      logger.debug("Deleting expired password reset tokens");

      const result = await prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        logger.info(`Deleted ${result.count} expired password reset tokens`);
      }

      return result.count;
    } catch (error) {
      logger.error("Error deleting expired password reset tokens", { error });
      throw new Error(
        `Failed to delete expired tokens: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Masks email for logging (privacy protection)
   * @param email - Email to mask
   * @returns Masked email (e.g., "j***@example.com")
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
