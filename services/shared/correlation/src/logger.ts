/**
 * Contextual logger wrapper
 *
 * Wraps Winston logger to automatically inject correlation ID and user context
 * from AsyncLocalStorage into every log entry.
 *
 * Usage:
 * ```typescript
 * import { createContextualLogger } from '@echo/correlation';
 *
 * const logger = createContextualLogger({
 *   serviceName: 'user-service',
 *   logLevel: 'info'
 * });
 *
 * // Logs automatically include correlationId, userId, workspaceId, etc.
 * logger.info('User created', { email: 'user@example.com' });
 * // Output: { timestamp, level, message, service, correlationId, userId, email }
 * ```
 */

import winston from "winston";
import { createLogger, LoggerConfig } from "@echo/logger";
import {
  getCorrelationId,
  getUserId,
  getWorkspaceId,
  getChannelId,
  getMethod,
  getPath,
} from "./context";

/**
 * Create a logger that automatically injects correlation context
 *
 * This wraps the base Winston logger and adds correlation ID and business context
 * to every log entry without requiring manual parameter passing.
 *
 * @param config - Logger configuration
 * @returns Winston logger with auto-context injection
 *
 * @example
 * ```typescript
 * const logger = createContextualLogger({
 *   serviceName: 'user-service',
 *   logLevel: 'debug'
 * });
 *
 * logger.info('Processing request');
 * // Automatically includes: correlationId, userId, workspaceId, method, path
 * ```
 */
export function createContextualLogger(config: LoggerConfig): winston.Logger {
  const baseLogger = createLogger(config);

  // Create a proxy that intercepts log method calls
  const handler: ProxyHandler<winston.Logger> = {
    get(target, prop) {
      // Intercept logging methods: error, warn, info, http, debug
      if (
        typeof prop === "string" &&
        ["error", "warn", "info", "http", "debug"].includes(prop)
      ) {
        return (message: string, meta?: any) => {
          // Get context from AsyncLocalStorage
          const contextMeta = {
            correlationId: getCorrelationId(),
            userId: getUserId(),
            workspaceId: getWorkspaceId(),
            channelId: getChannelId(),
            method: getMethod(),
            path: getPath(),
          };

          // Remove undefined values
          const cleanContext = Object.fromEntries(
            Object.entries(contextMeta).filter(([_, v]) => v !== undefined)
          );

          // Merge context with provided metadata
          const enrichedMeta = { ...cleanContext, ...meta };

          // Call original logger method with enriched metadata
          return (target as any)[prop](message, enrichedMeta);
        };
      }

      // Pass through all other properties
      return (target as any)[prop];
    },
  };

  return new Proxy(baseLogger, handler);
}
