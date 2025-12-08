/**
 * Morgan HTTP logger integration
 *
 * Provides Morgan middleware configured to work with Winston logger
 * and automatically include correlation context.
 *
 * Usage:
 * ```typescript
 * import { createContextualLogger, createHttpLogger } from '@echo/correlation';
 *
 * const logger = createContextualLogger({ serviceName: 'user-service' });
 * const httpLogger = createHttpLogger(logger);
 *
 * app.use(httpLogger);
 * ```
 */

import morgan from "morgan";
import winston from "winston";
import { createHttpStream } from "@echo/logger";
import { getCorrelationId, getUserId, getWorkspaceId } from "./context";

/**
 * Create Morgan HTTP logger middleware
 *
 * Configures Morgan to log HTTP requests with correlation context
 *
 * @param logger - Winston logger instance
 * @param format - Morgan format string (default: custom format with correlation ID)
 * @returns Morgan middleware
 *
 * @example
 * ```typescript
 * const logger = createContextualLogger({ serviceName: 'user-service' });
 * const httpLogger = createHttpLogger(logger);
 *
 * app.use(httpLogger);
 * ```
 */
export function createHttpLogger(
  logger: winston.Logger,
  format?: string
): ReturnType<typeof morgan> {
  // Register custom tokens
  morgan.token("correlation-id", () => getCorrelationId() || "-");
  morgan.token("user-id", () => getUserId() || "anonymous");
  morgan.token("workspace-id", () => getWorkspaceId() || "-");

  // Default format if not provided
  const logFormat = format || MorganFormats.detailed;

  // Create Morgan middleware using the logger's HTTP stream
  return morgan(logFormat, {
    stream: createHttpStream(logger),
  });
}

/**
 * Predefined Morgan formats with correlation context
 */
export const MorganFormats = {
  /**
   * Minimal format: method, url, status, time
   */
  minimal: ":method :url :status :response-time ms",

  /**
   * Standard format: includes correlation ID and user ID
   */
  standard:
    ":method :url :status :response-time ms - :correlation-id - :user-id",

  /**
   * Detailed format: includes workspace context
   */
  detailed:
    ":method :url :status :response-time ms - :correlation-id - :user-id - :workspace-id",

  /**
   * Combined format (similar to Apache combined log format)
   */
  combined:
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :correlation-id',
} as const;
