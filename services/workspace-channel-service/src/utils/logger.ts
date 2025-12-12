import { createContextualLogger } from "@echo/correlation";

/**
 * Contextual logger for workspace-channel-service
 * Automatically includes correlationId, userId, workspaceId, channelId in all log entries
 */
const logger = createContextualLogger({
  serviceName: "workspace-channel-service",
  logLevel: process.env.LOG_LEVEL || "info",
});

export default logger;
