/**
 * Custom error class for message-service operations
 * Follows the same pattern as workspace-channel-service for consistency
 */
export class MessageServiceError extends Error {
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
    this.name = "MessageServiceError";
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MessageServiceError);
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
    return new MessageServiceError(message, "VALIDATION_ERROR", 400, details);
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    return new MessageServiceError(message, "NOT_FOUND", 404);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message: string = "Unauthorized access") {
    return new MessageServiceError(message, "UNAUTHORIZED", 401);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = "Access forbidden") {
    return new MessageServiceError(message, "FORBIDDEN", 403);
  }

  /**
   * Create a conflict error (e.g., duplicate message)
   */
  static conflict(message: string, details?: Record<string, any>) {
    return new MessageServiceError(message, "CONFLICT", 409, details);
  }

  /**
   * Create a bad request error
   */
  static badRequest(message: string, details?: Record<string, any>) {
    return new MessageServiceError(message, "BAD_REQUEST", 400, details);
  }

  /**
   * Create an external service error (for user-service, workspace-channel-service calls)
   */
  static externalService(
    serviceName: string,
    message: string,
    details?: Record<string, any>
  ) {
    return new MessageServiceError(
      `${serviceName}: ${message}`,
      "EXTERNAL_SERVICE_ERROR",
      503,
      details
    );
  }

  /**
   * Create a database error
   */
  static database(message: string, details?: Record<string, any>) {
    return new MessageServiceError(message, "DATABASE_ERROR", 500, details);
  }

  /**
   * Create a database error with automatic logging
   *
   * Logs the internal error details for debugging while only exposing
   * a safe generic message to the client.
   *
   * @param publicMessage - Safe message to show to client
   * @param logContext - Context string for log identification
   * @param internalDetails - Internal error details (logged but not exposed)
   */
  static databaseWithLogging(
    publicMessage: string,
    logContext: string,
    internalDetails: Record<string, any>
  ) {
    // TODO: Replace console.error with proper logger (Winston, Pino, etc.)
    console.error(`Database error in ${logContext}:`, internalDetails);

    return new MessageServiceError(publicMessage, "DATABASE_ERROR", 500);
  }

  /**
   * Create a validation error with automatic logging
   *
   * @param publicMessage - Safe message to show to client
   * @param logContext - Context string for log identification
   * @param internalDetails - Internal error details (logged but not exposed)
   */
  static validationWithLogging(
    publicMessage: string,
    logContext: string,
    internalDetails: Record<string, any>
  ) {
    // TODO: Replace console.error with proper logger (Winston, Pino, etc.)
    console.error(`Validation error in ${logContext}:`, internalDetails);

    return new MessageServiceError(publicMessage, "VALIDATION_ERROR", 400);
  }

  /**
   * Create a message too long error
   */
  static messageTooLong(maxLength: number, actualLength: number) {
    return new MessageServiceError(
      `Message content exceeds maximum length of ${maxLength} characters (provided: ${actualLength})`,
      "MESSAGE_TOO_LONG",
      400,
      { maxLength, actualLength, field: "content" }
    );
  }

  /**
   * Create an empty message error
   */
  static emptyMessage() {
    return new MessageServiceError(
      "Message content cannot be empty",
      "EMPTY_MESSAGE",
      400,
      { field: "content" }
    );
  }

  /**
   * Create a channel membership error
   */
  static notChannelMember(channelId: string, userId: string) {
    return new MessageServiceError(
      "User is not a member of this channel",
      "NOT_CHANNEL_MEMBER",
      403,
      { channelId, userId }
    );
  }

  /**
   * Create a channel archived error
   */
  static channelArchived(channelId: string) {
    return new MessageServiceError(
      "Cannot send messages to an archived channel",
      "CHANNEL_ARCHIVED",
      403,
      { channelId }
    );
  }

  /**
   * Create a channel read-only error
   */
  static channelReadOnly(channelId: string) {
    return new MessageServiceError(
      "Cannot send messages to a read-only channel",
      "CHANNEL_READ_ONLY",
      403,
      { channelId }
    );
  }
}
