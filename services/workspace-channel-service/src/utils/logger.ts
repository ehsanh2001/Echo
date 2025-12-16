import { createLogger } from "@echo/logger";

/**
 * Logger for workspace-channel-service
 * OTel Winston instrumentation automatically injects trace_id and span_id
 */
const logger = createLogger({
  serviceName: "workspace-channel-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
