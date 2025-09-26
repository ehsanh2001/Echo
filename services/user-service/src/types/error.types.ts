/**
 * Error handling types and classes
 *
 * This module defines custom error classes and error-related types
 * for structured error handling throughout the application.
 */

/**
 * Custom error class for user service operations
 *
 * Provides structured error handling with error codes, HTTP status codes,
 * and optional additional details for debugging.
 *
 */
export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}
