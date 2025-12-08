/**
 * Echo Correlation Package
 *
 * Provides request correlation and context management using AsyncLocalStorage.
 * Automatically propagates correlation IDs and business context (userId, workspaceId, etc.)
 * through the call stack without explicit parameter passing.
 *
 * Key Features:
 * - Correlation ID generation and propagation
 * - AsyncLocalStorage-based context management
 * - Express middleware for automatic context creation
 * - Contextual logger that auto-injects correlation data
 * - Morgan HTTP logger integration
 *
 * Usage:
 * ```typescript
 * import {
 *   correlationMiddleware,
 *   createContextualLogger,
 *   createHttpLogger,
 *   setUserId,
 *   updateContext
 * } from '@echo/correlation';
 *
 * const app = express();
 * const logger = createContextualLogger({ serviceName: 'user-service' });
 *
 * // Add middleware
 * app.use(correlationMiddleware('user-service'));
 * app.use(createHttpLogger(logger));
 *
 * // In JWT middleware
 * app.use((req, res, next) => {
 *   if (req.user?.userId) {
 *     setUserId(req.user.userId);
 *   }
 *   next();
 * });
 *
 * // In route handlers
 * app.get('/api/users', (req, res) => {
 *   logger.info('Fetching users'); // Auto-includes correlationId, userId
 *   // ...
 * });
 * ```
 */

// Export context management
export {
  requestContext,
  getContext,
  getCorrelationId,
  getUserId,
  getWorkspaceId,
  getChannelId,
  getMethod,
  getPath,
  getIp,
  getUserAgent,
  setUserId,
  setWorkspaceId,
  setChannelId,
  updateContext,
  hasContext,
} from "./context";

// Export types
export type { RequestContext, ContextUpdate } from "./types";

// Export middleware
export { correlationMiddleware, userContextMiddleware } from "./middleware";

// Export contextual logger
export { createContextualLogger } from "./logger";

// Export HTTP logger
export { createHttpLogger, MorganFormats } from "./http";

// Re-export LoggerConfig from @echo/logger for convenience
export type { LoggerConfig } from "@echo/logger";
