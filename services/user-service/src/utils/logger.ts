import { createLogger } from "@echo/logger";

/**
 * Logger for user-service
 * OTel Winston instrumentation automatically injects trace_id and span_id
 */
const logger = createLogger({
  serviceName: "user-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
