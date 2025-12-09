import { createContextualLogger } from "@echo/correlation";

/**
 * Contextual logger for status-service
 * Automatically includes correlationId, userId in all log entries
 */
const logger = createContextualLogger({
  serviceName: "status-service",
  logLevel: process.env.LOG_LEVEL || "info",
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === "true",
  logDir: process.env.LOG_DIR || "./logs",
});

export default logger;
