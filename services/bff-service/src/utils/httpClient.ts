/**
 * Shared HTTP Client for BFF Service
 *
 * Pre-configured HTTP client instance for making requests to backend services
 * with automatic correlation ID propagation.
 */

import { createHttpClient } from "@echo/http-client";
import { config } from "../config/env";

/**
 * Shared HTTP client instance
 * Automatically propagates correlation IDs to all downstream services
 */
export const httpClient = createHttpClient({
  serviceName: "bff-service",
  timeout: 30000,
  maxRetries: 3,
  debugLogging: config.nodeEnv === "development",
});
