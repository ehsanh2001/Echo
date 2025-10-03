/**
 * Custom error class for workspace-channel-service operations
 * Follows the same pattern as user-service for consistency
 */
export class WorkspaceChannelServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string = "UNKNOWN_ERROR",
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "WorkspaceChannelServiceError";
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkspaceChannelServiceError);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }

  /**
   * Create a validation error
   */
  static validation(message: string, details?: Record<string, any>) {
    return new WorkspaceChannelServiceError(
      message,
      "VALIDATION_ERROR",
      400,
      details
    );
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    return new WorkspaceChannelServiceError(message, "NOT_FOUND", 404);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message: string = "Unauthorized access") {
    return new WorkspaceChannelServiceError(message, "UNAUTHORIZED", 401);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = "Access forbidden") {
    return new WorkspaceChannelServiceError(message, "FORBIDDEN", 403);
  }

  /**
   * Create a conflict error (e.g., duplicate workspace name)
   */
  static conflict(message: string, details?: Record<string, any>) {
    return new WorkspaceChannelServiceError(message, "CONFLICT", 409, details);
  }

  /**
   * Create a bad request error
   */
  static badRequest(message: string, details?: Record<string, any>) {
    return new WorkspaceChannelServiceError(
      message,
      "BAD_REQUEST",
      400,
      details
    );
  }

  /**
   * Create an external service error
   */
  static externalService(
    service: string,
    message: string = "External service unavailable"
  ) {
    return new WorkspaceChannelServiceError(
      `${service}: ${message}`,
      "EXTERNAL_SERVICE_ERROR",
      503,
      { service }
    );
  }

  /**
   * Create a database error
   */
  static database(message: string, details?: Record<string, any>) {
    return new WorkspaceChannelServiceError(
      `Database operation failed: ${message}`,
      "DATABASE_ERROR",
      500,
      details
    );
  }
}
