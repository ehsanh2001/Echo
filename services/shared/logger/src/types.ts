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
