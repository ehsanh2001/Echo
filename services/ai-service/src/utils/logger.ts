import { createLogger } from "@echo/logger";

/**
 * Logger for ai-service
 * OTel Winston instrumentation automatically adds trace_id/span_id
 */
const logger = createLogger({
  serviceName: "ai-service",
  logLevel: process.env.LOG_LEVEL || "info",
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === "true",
  logDir: process.env.LOG_DIR || "./logs",
});

export default logger;
