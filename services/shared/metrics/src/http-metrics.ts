/**
 * HTTP Metrics
 *
 * Provides metrics for HTTP requests including:
 * - Request count (counter)
 * - Request duration (histogram)
 * - Requests in flight (gauge)
 */

import { Counter, Histogram, Gauge } from "prom-client";
import {
  createCounter,
  createHistogram,
  createGauge,
  getConfig,
} from "./registry";
import { DEFAULT_CONFIG } from "./types";

let httpRequestsTotal: Counter<"method" | "route" | "status_code"> | null =
  null;
let httpRequestDuration: Histogram<"method" | "route" | "status_code"> | null =
  null;
let httpRequestsInFlight: Gauge<"method"> | null = null;

/**
 * Initialize HTTP metrics
 * Called automatically by metricsMiddleware
 */
export function initHttpMetrics(): void {
  if (httpRequestsTotal) {
    return; // Already initialized
  }

  const config = getConfig();
  const buckets = config?.durationBuckets ?? DEFAULT_CONFIG.durationBuckets;

  // Total HTTP requests counter
  httpRequestsTotal = createCounter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
  });

  // HTTP request duration histogram
  httpRequestDuration = createHistogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets,
  });

  // HTTP requests currently in flight
  httpRequestsInFlight = createGauge({
    name: "http_requests_in_flight",
    help: "Number of HTTP requests currently being processed",
    labelNames: ["method"],
  });
}

/**
 * Record the start of an HTTP request
 *
 * @param method - HTTP method
 * @returns Timer function to call when request completes
 */
export function startHttpRequest(method: string): () => void {
  if (!httpRequestsInFlight) {
    return () => {}; // Metrics not initialized
  }

  httpRequestsInFlight.inc({ method });
  const startTime = process.hrtime.bigint();

  return () => {
    httpRequestsInFlight?.dec({ method });
  };
}

/**
 * Record HTTP request completion
 *
 * @param method - HTTP method
 * @param route - Request route/path
 * @param statusCode - HTTP status code
 * @param durationMs - Request duration in milliseconds
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  if (!httpRequestsTotal || !httpRequestDuration) {
    return; // Metrics not initialized
  }

  const labels = {
    method,
    route,
    status_code: String(statusCode),
  };

  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationMs / 1000); // Convert to seconds
}

/**
 * Get current HTTP metrics instances (for testing)
 */
export function getHttpMetrics() {
  return {
    httpRequestsTotal,
    httpRequestDuration,
    httpRequestsInFlight,
  };
}
