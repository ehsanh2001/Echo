/**
 * Echo Shared Logger
 *
 * Provides standardized JSON logging for containerized Echo services:
 * - Always outputs JSON format to stdout/stderr
 * - Service name tagging
 * - Automatic correlation ID injection via @echo/correlation
 * - Optimized for Grafana/Loki log aggregation
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@echo/logger';
 *
 * const logger = createLogger({
 *   serviceName: 'user-service',
 *   logLevel: 'info'
 * });
 *
 * logger.info('User created', { userId: '123', email: 'user@example.com' });
 * logger.error('Failed to create user', { error: err.message });
 * ```
 */

import winston from "winston";
import { LoggerConfig, LOG_LEVELS, LogContext } from "./types";
import { createLogFormat, createTransports, getLogLevel } from "./config";

/**
 * Create a Winston logger instance for a service
 * Always outputs JSON to stdout for container log aggregation
 *
 * @param config - Logger configuration
 * @returns Winston logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   serviceName: 'user-service',
 *   logLevel: 'debug'
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
export { LOG_LEVELS } from "./types";
