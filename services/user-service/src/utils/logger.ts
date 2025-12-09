import { createContextualLogger } from "@echo/correlation";

/**
 * Contextual logger for user-service
 * Automatically includes correlationId, userId, and other context in all log entries
 */
const logger = createContextualLogger({
  serviceName: "user-service",
  logLevel: process.env.LOG_LEVEL || "info",
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === "true",
  logDir: process.env.LOG_DIR || "./logs",
});

export default logger;
