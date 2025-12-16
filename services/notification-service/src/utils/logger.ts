import { createLogger } from "@echo/logger";

/**
 * Logger for notification-service
 * OTel Winston instrumentation automatically injects trace_id and span_id
 */
const logger = createLogger({
  serviceName: "notification-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
