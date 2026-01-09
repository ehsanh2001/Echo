import { injectable, inject } from "tsyringe";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import logger from "../utils/logger";
import { redisService } from "../utils/redis";
import { IPasswordResetService } from "../interfaces/services/IPasswordResetService";
import { IPasswordResetRepository } from "../interfaces/repositories/IPasswordResetRepository";
import { IUserRepository } from "../interfaces/repositories/IUserRepository";
import { IRabbitMQService } from "../interfaces/services/IRabbitMQService";
import {
  ValidateResetTokenResponse,
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
} from "../types/passwordReset.types";
import { UserServiceError } from "../types/error.types";

/**
 * Password Reset Service implementation
 *
 * Handles password reset flow including:
 * - Rate-limited reset requests
 * - Secure token generation and validation
 * - Password updates with session invalidation
 * - Event publishing for email and socket notifications
 */
@injectable()
export class PasswordResetService implements IPasswordResetService {
  constructor(
    @inject("IPasswordResetRepository")
    private passwordResetRepository: IPasswordResetRepository,
    @inject("IUserRepository")
    private userRepository: IUserRepository,
    @inject("IRabbitMQService")
    private rabbitMQService: IRabbitMQService
  ) {}

  /**
   * Requests a password reset for the given email
   *
   * Implements rate limiting per email address:
   * - Up to config.requestLimit requests per config.rateLimitWindowMinutes
   * - Always returns success to prevent email enumeration
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Check if user exists - silently return if not
      const user = await this.userRepository.findByEmail(normalizedEmail);
      if (!user) {
        logger.debug("Password reset requested for non-existent email", {
          email: this.maskEmail(normalizedEmail),
        });
        return;
      }

      // Check rate limiting
      const existingToken =
        await this.passwordResetRepository.findByEmail(normalizedEmail);

      if (existingToken) {
        const rateLimitResult = this.checkRateLimit(existingToken);
        if (!rateLimitResult.allowed) {
          logger.warn("Password reset rate limit exceeded", {
            email: this.maskEmail(normalizedEmail),
          });
          return; // Silently return - don't reveal rate limiting
        }
      }

      // Generate secure token
      const tokenId = uuidv4();
      const tokenSecret = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(
        tokenSecret,
        config.bcrypt.saltRounds
      );
      const expiresAt = new Date(
        Date.now() + config.passwordReset.tokenExpiryMinutes * 60 * 1000
      );

      // Create or update token record
      if (existingToken) {
        const windowExpired = this.isRateLimitWindowExpired(existingToken);
        await this.passwordResetRepository.update(normalizedEmail, {
          tokenId,
          tokenHash,
          expiresAt,
          firstReqTime: windowExpired ? new Date() : existingToken.firstReqTime,
          reqCount: windowExpired ? 1 : existingToken.reqCount + 1,
        });
      } else {
        await this.passwordResetRepository.create({
          email: normalizedEmail,
          tokenId,
          tokenHash,
          expiresAt,
          firstReqTime: new Date(),
          reqCount: 1,
        });
      }

      // Build reset URL and publish event
      const fullToken = `${tokenId}.${tokenSecret}`;
      const resetUrl = `${config.frontend.url}/reset-password?token=${fullToken}`;

      await this.publishPasswordResetRequestedEvent({
        email: normalizedEmail,
        resetToken: fullToken,
        resetUrl,
        expiresAt,
      });

      logger.info("Password reset email requested", {
        email: this.maskEmail(normalizedEmail),
        userId: user.id,
      });
    } catch (error) {
      logger.error("Error processing password reset request", { error });
      // Don't throw - always return success to prevent enumeration
    }
  }

  /**
   * Validates a password reset token
   */
  async validateToken(token: string): Promise<ValidateResetTokenResponse> {
    try {
      const parsed = this.parseToken(token);
      if (!parsed) {
        return { valid: false };
      }

      const { tokenId, tokenSecret } = parsed;

      // Find token record
      const tokenRecord =
        await this.passwordResetRepository.findByTokenId(tokenId);
      if (!tokenRecord) {
        return { valid: false };
      }

      // Check expiration
      if (new Date() > tokenRecord.expiresAt) {
        // Delete expired token
        await this.passwordResetRepository.deleteByEmail(tokenRecord.email);
        return { valid: false };
      }

      // Verify token secret
      const isValid = await bcrypt.compare(tokenSecret, tokenRecord.tokenHash);
      if (!isValid) {
        return { valid: false };
      }

      return {
        valid: true,
        email: this.maskEmail(tokenRecord.email),
      };
    } catch (error) {
      logger.error("Error validating reset token", { error });
      return { valid: false };
    }
  }

  /**
   * Resets the user's password using a valid token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const parsed = this.parseToken(token);
    if (!parsed) {
      throw new UserServiceError("Invalid reset token", "INVALID_TOKEN", 400);
    }

    const { tokenId, tokenSecret } = parsed;

    // Find and validate token
    const tokenRecord =
      await this.passwordResetRepository.findByTokenId(tokenId);
    if (!tokenRecord) {
      throw new UserServiceError("Invalid reset token", "INVALID_TOKEN", 400);
    }

    // Check expiration
    if (new Date() > tokenRecord.expiresAt) {
      await this.passwordResetRepository.deleteByEmail(tokenRecord.email);
      throw new UserServiceError(
        "Reset token has expired",
        "TOKEN_EXPIRED",
        400
      );
    }

    // Verify token secret
    const isValid = await bcrypt.compare(tokenSecret, tokenRecord.tokenHash);
    if (!isValid) {
      throw new UserServiceError("Invalid reset token", "INVALID_TOKEN", 400);
    }

    // Find user
    const user = await this.userRepository.findByEmail(tokenRecord.email);
    if (!user) {
      throw new UserServiceError("User not found", "USER_NOT_FOUND", 404);
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(
      newPassword,
      config.bcrypt.saltRounds
    );
    await this.userRepository.updatePassword(user.id, passwordHash);

    // Delete the reset token
    await this.passwordResetRepository.deleteByEmail(tokenRecord.email);

    // Invalidate all sessions by removing refresh token
    await redisService.removeRefreshToken(user.id);

    // Publish password reset completed event for socket logout
    await this.publishPasswordResetCompletedEvent({
      userId: user.id,
      email: tokenRecord.email,
    });

    logger.info("Password reset successfully", {
      userId: user.id,
      email: this.maskEmail(tokenRecord.email),
    });
  }

  /**
   * Parses a token string into tokenId and tokenSecret
   */
  private parseToken(
    token: string
  ): { tokenId: string; tokenSecret: string } | null {
    if (!token || typeof token !== "string") {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
      return null;
    }

    const [tokenId, tokenSecret] = parts;
    if (!tokenId || !tokenSecret) {
      return null;
    }

    return { tokenId, tokenSecret };
  }

  /**
   * Checks if the rate limit allows a new request
   */
  private checkRateLimit(existingToken: {
    reqCount: number;
    firstReqTime: Date;
  }): { allowed: boolean } {
    // If window expired, allow request
    if (this.isRateLimitWindowExpired(existingToken)) {
      return { allowed: true };
    }

    // Check if under limit
    if (existingToken.reqCount < config.passwordReset.requestLimit) {
      return { allowed: true };
    }

    return { allowed: false };
  }

  /**
   * Checks if the rate limit window has expired
   */
  private isRateLimitWindowExpired(existingToken: {
    firstReqTime: Date;
  }): boolean {
    const windowMs = config.passwordReset.rateLimitWindowMinutes * 60 * 1000;
    const windowExpiry = new Date(
      existingToken.firstReqTime.getTime() + windowMs
    );
    return new Date() > windowExpiry;
  }

  /**
   * Publishes password reset requested event to RabbitMQ
   */
  private async publishPasswordResetRequestedEvent(data: {
    email: string;
    resetToken: string;
    resetUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    const event: PasswordResetRequestedEvent = {
      eventId: uuidv4(),
      eventType: "user.password.reset.requested",
      aggregateType: "user",
      aggregateId: data.email,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        email: data.email,
        resetToken: data.resetToken,
        resetUrl: data.resetUrl,
        expiresAt: data.expiresAt.toISOString(),
      },
      metadata: {
        source: "user-service",
      },
    };

    await this.rabbitMQService.publish("user.password.reset.requested", event);
  }

  /**
   * Publishes password reset completed event to RabbitMQ
   */
  private async publishPasswordResetCompletedEvent(data: {
    userId: string;
    email: string;
  }): Promise<void> {
    const event: PasswordResetCompletedEvent = {
      eventId: uuidv4(),
      eventType: "user.password.reset",
      aggregateType: "user",
      aggregateId: data.userId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        userId: data.userId,
        email: data.email,
      },
      metadata: {
        source: "user-service",
      },
    };

    await this.rabbitMQService.publish("user.password.reset", event);
  }

  /**
   * Masks email for logging (privacy protection)
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
