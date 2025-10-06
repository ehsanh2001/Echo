import { ValidationError } from "../types";
import { WorkspaceChannelServiceError } from "./errors";

/**
 * Validation utilities for workspace-channel-service
 */

/**
 * Validates workspace name format
 * Names are alphanumerical and can have "._-"
 */
export function validateWorkspaceName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!name || name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Name is required",
      value: name,
    });
    return errors;
  }

  const trimmedName = name.trim();

  // Length validation
  if (trimmedName.length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters long",
      value: name,
    });
  }

  if (trimmedName.length > 50) {
    errors.push({
      field: "name",
      message: "Name must not exceed 50 characters",
      value: name,
    });
  }

  // Format validation: alphanumerical and can have "._-"
  const namePattern = /^[a-zA-Z0-9._-]+$/;
  if (!namePattern.test(trimmedName)) {
    errors.push({
      field: "name",
      message:
        "Name can only contain letters, numbers, dots, underscores, and hyphens",
      value: name,
    });
  }

  // Cannot start or end with special characters
  const startsEndsPattern = /^[a-zA-Z0-9].*[a-zA-Z0-9]$/;
  if (!startsEndsPattern.test(trimmedName)) {
    errors.push({
      field: "name",
      message: "Name must start and end with a letter or number",
      value: name,
    });
  }

  return errors;
}

/**
 * Validates workspace display name
 */
export function validateWorkspaceDisplayName(
  displayName?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (displayName !== undefined) {
    const trimmedDisplayName = displayName.trim();

    if (trimmedDisplayName.length === 0) {
      errors.push({
        field: "displayName",
        message: "Display name cannot be empty if provided",
        value: displayName,
      });
    }

    if (trimmedDisplayName.length > 100) {
      errors.push({
        field: "displayName",
        message: "Display name must not exceed 100 characters",
        value: displayName,
      });
    }
  }

  return errors;
}

/**
 * Validates workspace description
 */
export function validateWorkspaceDescription(
  description?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (description !== undefined) {
    const trimmedDescription = description.trim();

    if (trimmedDescription.length > 500) {
      errors.push({
        field: "description",
        message: "Description must not exceed 500 characters",
        value: description,
      });
    }
  }

  return errors;
}

/**
 * Validates create workspace request
 */
export function validateCreateWorkspaceRequest(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate required fields
  if (typeof data !== "object" || data === null) {
    errors.push({
      field: "request",
      message: "Request body must be a valid JSON object",
      value: data,
    });
    return errors;
  }

  // Validate name
  errors.push(...validateWorkspaceName(data.name));

  // Validate displayName if provided
  if (data.displayName !== undefined) {
    errors.push(...validateWorkspaceDisplayName(data.displayName));
  }

  // Validate description if provided
  if (data.description !== undefined) {
    errors.push(...validateWorkspaceDescription(data.description));
  }

  return errors;
}

/**
 * Throws a validation error if there are validation errors
 */
export function throwIfValidationErrors(
  errors: ValidationError[],
  message: string = "Validation failed"
): void {
  if (errors.length > 0) {
    throw WorkspaceChannelServiceError.validation(message, {
      validationErrors: errors,
    });
  }
}
