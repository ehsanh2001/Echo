/**
 * BFF Service Logger
 *
 * Contextual logger that auto-injects correlation ID and user context
 * from AsyncLocalStorage into every log entry.
 *
 * Usage:
 * ```typescript
 * import logger from './utils/logger';
 *
 * logger.info('Processing request', { userId: '123' });
 * // Output includes: correlationId, userId, workspaceId (automatically)
 * ```
 */

import { createContextualLogger } from "@echo/correlation";

// Create contextual logger for BFF service
const logger = createContextualLogger({
  serviceName: "bff-service",
  logLevel: process.env.LOG_LEVEL || "info",
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === "true",
  logDir: process.env.LOG_DIR || "./logs",
});

export default logger;
