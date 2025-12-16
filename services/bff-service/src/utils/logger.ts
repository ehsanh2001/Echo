/**
 * BFF Service Logger
 *
 * Logger that outputs JSON to stdout for Grafana/Loki.
 * OTel Winston instrumentation automatically injects trace_id and span_id.
 *
 * Usage:
 * ```typescript
 * import logger from './utils/logger';
 *
 * logger.info('Processing request', { userId: '123' });
 * // Output includes trace_id, span_id automatically via OTel
 * ```
 */

import { createLogger } from "@echo/logger";

// Create logger for BFF service
const logger = createLogger({
  serviceName: "bff-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
