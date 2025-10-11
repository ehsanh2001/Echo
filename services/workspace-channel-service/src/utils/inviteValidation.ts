import { CreateWorkspaceInviteRequest, ValidationError } from "../types";
import { config } from "../config/env";

/**
 * Validation functions for invite requests
 */
export class InviteValidation {
  /**
   * Validate email format
   * @param email - The email to validate
   * @returns True if email format is valid
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate workspace role
   * @param role - The role to validate
   * @returns True if role is valid
   */
  static isValidWorkspaceRole(
    role: string
  ): role is "owner" | "admin" | "member" | "guest" {
    return ["owner", "admin", "member", "guest"].includes(role);
  }

  /**
   * Validate expiration days
   * @param days - The number of days to validate
   * @returns True if days is within valid range
   */
  static isValidExpirationDays(days: number): boolean {
    return (
      Number.isInteger(days) &&
      days >= config.invites.minExpirationDays &&
      days <= config.invites.maxExpirationDays
    );
  }

  /**
   * Validate custom message length
   * @param message - The message to validate
   * @returns True if message is within length limit
   */
  static isValidCustomMessage(message: string): boolean {
    return message.length <= config.invites.maxCustomMessageLength;
  }

  /**
   * Validate create workspace invite request
   * @param request - The invite request to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validateCreateWorkspaceInviteRequest(
    request: CreateWorkspaceInviteRequest
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate email
    if (!request.email) {
      errors.push({
        field: "email",
        message: "Email is required",
        value: request.email,
      });
    } else if (typeof request.email !== "string") {
      errors.push({
        field: "email",
        message: "Email must be a string",
        value: request.email,
      });
    } else if (!this.isValidEmail(request.email.trim())) {
      errors.push({
        field: "email",
        message: "Email format is invalid",
        value: request.email,
      });
    }

    // Validate role (if provided)
    if (request.role !== undefined) {
      if (typeof request.role !== "string") {
        errors.push({
          field: "role",
          message: "Role must be a string",
          value: request.role,
        });
      } else if (!this.isValidWorkspaceRole(request.role)) {
        errors.push({
          field: "role",
          message: "Role must be one of: owner, admin, member, guest",
          value: request.role,
        });
      }
    }

    // Validate expiresInDays (if provided)
    if (request.expiresInDays !== undefined) {
      if (typeof request.expiresInDays !== "number") {
        errors.push({
          field: "expiresInDays",
          message: "Expires in days must be a number",
          value: request.expiresInDays,
        });
      } else if (!this.isValidExpirationDays(request.expiresInDays)) {
        errors.push({
          field: "expiresInDays",
          message: `Expires in days must be between ${config.invites.minExpirationDays} and ${config.invites.maxExpirationDays}`,
          value: request.expiresInDays,
        });
      }
    }

    // Validate customMessage (if provided)
    if (request.customMessage !== undefined) {
      if (typeof request.customMessage !== "string") {
        errors.push({
          field: "customMessage",
          message: "Custom message must be a string",
          value: request.customMessage,
        });
      } else if (!this.isValidCustomMessage(request.customMessage)) {
        errors.push({
          field: "customMessage",
          message: `Custom message cannot exceed ${config.invites.maxCustomMessageLength} characters`,
          value: request.customMessage.length,
        });
      }
    }

    return errors;
  }
}

/**
 * Throws a validation error if any validation errors exist
 * @param errors - Array of validation errors
 * @param context - Context message for the error
 * @throws WorkspaceChannelServiceError if errors exist
 */
export function throwIfValidationErrors(
  errors: ValidationError[],
  context: string
): void {
  if (errors.length > 0) {
    // Import here to avoid circular dependency
    const { WorkspaceChannelServiceError } = require("./errors");

    const errorMessage = `${context}: ${errors
      .map((e) => `${e.field}: ${e.message}`)
      .join(", ")}`;

    throw WorkspaceChannelServiceError.badRequest(errorMessage, {
      validationErrors: errors,
    });
  }
}
