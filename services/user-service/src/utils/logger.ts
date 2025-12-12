import { createContextualLogger } from "@echo/correlation";

/**
 * Contextual logger for user-service
 * Automatically includes correlationId, userId, and other context in all log entries
 */
const logger = createContextualLogger({
  serviceName: "user-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
