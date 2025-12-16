/**
 * @echo/telemetry
 *
 * OpenTelemetry distributed tracing and request context for Echo services.
 *
 * This package provides:
 * - Distributed tracing with auto-instrumentation
 * - Request context management (userId, workspaceId, channelId)
 * - Express middleware for context propagation
 *
 * Usage (auto-init with env vars):
 *
 *   // At the VERY TOP of your service entry point
 *   import '@echo/telemetry';
 *
 * Usage (with options):
 *
 *   import { initTelemetry } from '@echo/telemetry';
 *   initTelemetry({ serviceName: 'my-service' });
 *
 * Request Context:
 *
 *   import {
 *     requestContextMiddleware,
 *     setUserId,
 *     getUserId,
 *     getTraceId
 *   } from '@echo/telemetry';
 *
 *   app.use(requestContextMiddleware());
 *   // In auth middleware: setUserId(user.id);
 *   // In handlers: getUserId(), getTraceId()
 *
 * Environment variables:
 *   - OTEL_SERVICE_NAME: Service name (required if not passed in options)
 *   - OTEL_EXPORTER_OTLP_ENDPOINT: OTel collector endpoint (default: http://otel-collector:4317)
 *   - OTEL_SAMPLE_RATIO: Sampling ratio 0.0-1.0 (default: 1.0 in dev, 0.2 in prod)
 *   - OTEL_SDK_DISABLED: Set to 'true' to disable telemetry
 *   - OTEL_DEBUG: Set to 'true' to enable debug logging
 */

// Export types
export type {
  TelemetryConfig,
  TelemetryOptions,
  RequestContext,
  ContextUpdate,
} from "./types";

// Export configuration utilities
export { buildConfig, isTelemetryEnabled } from "./config";

// Export tracing functions
export {
  initTelemetry,
  getTraceId,
  getSpanId,
  isTelemetryInitialized,
  getOtelApi,
} from "./tracing";

// Export request context functions (replaces @echo/correlation)
export {
  getRequestContext,
  hasContext,
  getUserId,
  getWorkspaceId,
  getChannelId,
  getMethod,
  getPath,
  getIp,
  getUserAgent,
  setUserId,
  setWorkspaceId,
  setChannelId,
  updateContext,
  requestContextMiddleware,
  userContextMiddleware,
  runWithContext,
  runWithContextAsync,
} from "./request-context";

// Re-export OTel API for convenience
export { trace, context, SpanStatusCode } from "@opentelemetry/api";
export type { Span, SpanContext, Tracer } from "@opentelemetry/api";

// Auto-initialize if OTEL_SERVICE_NAME is set
// This allows simple `import '@echo/telemetry'` usage
import { initTelemetry, isTelemetryInitialized } from "./tracing";
import { isTelemetryEnabled } from "./config";

if (
  process.env.OTEL_SERVICE_NAME &&
  isTelemetryEnabled() &&
  !isTelemetryInitialized()
) {
  initTelemetry();
}
