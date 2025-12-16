import { createLogger } from "@echo/logger";

/**
 * Logger for message-service
 * OTel Winston instrumentation automatically injects trace_id and span_id
 */
const logger = createLogger({
  serviceName: "message-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
