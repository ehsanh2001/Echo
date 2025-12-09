import { createContextualLogger } from "@echo/correlation";

/**
 * Contextual logger for message-service
 * Automatically includes correlationId, userId, workspaceId, channelId in all log entries
 */
const logger = createContextualLogger({
  serviceName: "message-service",
  logLevel: process.env.LOG_LEVEL || "info",
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === "true",
  logDir: process.env.LOG_DIR || "./logs",
});

export default logger;
