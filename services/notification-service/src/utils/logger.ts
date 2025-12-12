import { createContextualLogger } from "@echo/correlation";

/**
 * Contextual logger for notification-service
 * Automatically includes correlationId, userId in all log entries
 */
const logger = createContextualLogger({
  serviceName: "notification-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
