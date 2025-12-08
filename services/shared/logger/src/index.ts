/**
 * Echo Shared Logger
 *
 * Provides standardized Winston logging across all Echo services with:
 * - Environment-based formatting (JSON for prod, colorized for dev)
 * - Daily log file rotation
 * - Service name tagging
 * - Correlation ID support (will be auto-injected in Phase 2)
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@echo/logger';
 *
 * const logger = createLogger({
 *   serviceName: 'user-service',
 *   logLevel: 'info',
 *   enableFileLogging: true
 * });
 *
 * logger.info('User created', { userId: '123', email: 'user@example.com' });
 * logger.error('Failed to create user', { error: err.message });
 * ```
 */

import winston from "winston";
import { LoggerConfig, LOG_LEVELS, LogContext } from "./types";
import {
  createLogFormat,
  createTransports,
  getLogLevel,
  initializeColors,
} from "./config";

// Initialize Winston colors
initializeColors();

/**
 * Create a Winston logger instance for a service
 *
 * @param config - Logger configuration
 * @returns Winston logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   serviceName: 'user-service',
 *   logLevel: 'debug',
 *   enableFileLogging: true,
 *   logDir: './logs'
 * });
 *
 * logger.info('Service started');
 * logger.error('Database error', { error: err.message, userId: '123' });
 * ```
 */
export function createLogger(config: LoggerConfig): winston.Logger {
  const format = createLogFormat(config.serviceName);
  const transports = createTransports(config);
  const level = getLogLevel(config);

  const logger = winston.createLogger({
    level,
    levels: LOG_LEVELS,
    format,
    transports,
    exitOnError: false,
  });

  return logger;
}

/**
 * Create HTTP stream for Morgan integration
 *
 * @param logger - Winston logger instance
 * @returns Stream object for Morgan
 *
 * @example
 * ```typescript
 * import morgan from 'morgan';
 * import { createLogger, createHttpStream } from '@echo/logger';
 *
 * const logger = createLogger({ serviceName: 'user-service' });
 * const httpStream = createHttpStream(logger);
 *
 * app.use(morgan('combined', { stream: httpStream }));
 * ```
 */
export function createHttpStream(logger: winston.Logger) {
  return {
    write: (message: string) => {
      logger.http(message.trim());
    },
  };
}

// Re-export types for convenience
export type { LoggerConfig, LogContext } from "./types";
export { LOG_LEVELS, LOG_COLORS } from "./types";
