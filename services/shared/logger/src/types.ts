/**
 * Type definitions for Echo logger
 */

/**
 * Log context that can be included in log entries
 * These fields will be automatically injected when AsyncLocalStorage is implemented in Phase 2
 */
export interface LogContext {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  channelId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any; // Allow additional custom fields
}

/**
 * Configuration options for creating a logger instance
 */
export interface LoggerConfig {
  /**
   * Name of the service using this logger (e.g., 'user-service')
   * Will be included in all log entries
   */
  serviceName: string;

  /**
   * Log level (error, warn, info, http, debug)
   * Defaults to 'info' in production, 'debug' in development
   */
  logLevel?: string;

  /**
   * Enable file logging (creates log files in logDir)
   * Defaults to true
   */
  enableFileLogging?: boolean;

  /**
   * Directory where log files will be created
   * Defaults to './logs'
   */
  logDir?: string;

  /**
   * Maximum size of each log file before rotation (in bytes)
   * Defaults to 5MB (5 * 1024 * 1024)
   */
  maxFileSize?: string;

  /**
   * Maximum number of log files to keep
   * Defaults to 5
   */
  maxFiles?: string;
}

/**
 * Log levels supported by Winston
 */
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

/**
 * Colors for console output in development
 */
export const LOG_COLORS = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
} as const;
