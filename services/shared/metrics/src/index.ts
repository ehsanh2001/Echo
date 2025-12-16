/**
 * @echo/metrics
 *
 * Prometheus metrics for Echo services.
 *
 * This package provides:
 * - HTTP request metrics (RED: Request rate, Error rate, Duration)
 * - Node.js runtime metrics (memory, CPU, event loop, GC)
 * - Custom business metrics helpers
 * - Express middleware for automatic metric collection
 * - /metrics endpoint handler for Prometheus scraping
 *
 * Quick Start:
 *
 * ```typescript
 * import express from 'express';
 * import { metricsMiddleware, metricsEndpoint } from '@echo/metrics';
 *
 * const app = express();
 *
 * // Add metrics middleware (should be early in middleware chain)
 * app.use(metricsMiddleware({ serviceName: 'my-service' }));
 *
 * // Add metrics endpoint for Prometheus to scrape
 * app.get('/metrics', metricsEndpoint());
 *
 * // Your routes...
 * app.get('/api/users', (req, res) => { ... });
 * ```
 *
 * Custom Metrics:
 *
 * ```typescript
 * import { createCounter, createGauge, createHistogram } from '@echo/metrics';
 *
 * // Create custom metrics
 * const messagesCounter = createCounter({
 *   name: 'messages_sent_total',
 *   help: 'Total messages sent',
 *   labelNames: ['channel_type'],
 * });
 *
 * // Use in your code
 * messagesCounter.inc({ channel_type: 'public' });
 * ```
 */

// Export types
export type { MetricsConfig, HttpMetricLabels } from "./types";
export { DEFAULT_CONFIG } from "./types";

// Export registry functions
export {
  getRegistry,
  initRegistry,
  isRegistryInitialized,
  getConfig,
  createCounter,
  createGauge,
  createHistogram,
  createSummary,
  resetRegistry,
} from "./registry";

// Export middleware
export {
  metricsMiddleware,
  metricsEndpoint,
  getMetricsString,
  getMetricsContentType,
} from "./middleware";

// Export HTTP metrics
export {
  initHttpMetrics,
  startHttpRequest,
  recordHttpRequest,
  getHttpMetrics,
} from "./http-metrics";

// Export business metrics helpers
export {
  createUserRegistrationsCounter,
  createLoginAttemptsCounter,
  createMessagesSentCounter,
  createWorkspacesCreatedCounter,
  createChannelsCreatedCounter,
  createInvitesSentCounter,
  createWebSocketConnectionsGauge,
  createWebSocketEventsCounter,
  createNotificationsSentCounter,
  createRabbitMQMessagesCounter,
  createRabbitMQProcessingDuration,
  createDatabaseQueryDuration,
  createDatabaseQueriesCounter,
} from "./business-metrics";

// Re-export prom-client types for convenience
export { Counter, Gauge, Histogram, Summary, Registry } from "prom-client";

export type {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  SummaryConfiguration,
} from "prom-client";
