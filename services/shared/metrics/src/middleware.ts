/**
 * Express Metrics Middleware
 *
 * Provides Express middleware for automatic HTTP metrics collection
 * and a /metrics endpoint handler.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getRegistry, initRegistry, isRegistryInitialized } from "./registry";
import {
  initHttpMetrics,
  startHttpRequest,
  recordHttpRequest,
} from "./http-metrics";
import { MetricsConfig, DEFAULT_CONFIG } from "./types";

/**
 * Normalize route path for metrics labels
 * Replaces dynamic path segments with placeholders
 *
 * @param req - Express request
 * @returns Normalized route string
 */
function normalizeRoute(req: Request): string {
  // Use Express route if available (from router)
  if (req.route?.path) {
    return req.baseUrl + req.route.path;
  }

  // Fallback: normalize the path by replacing UUIDs and numeric IDs
  let path = req.path;

  // Replace UUIDs
  path = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ":id"
  );

  // Replace numeric IDs
  path = path.replace(/\/\d+/g, "/:id");

  return path;
}

/**
 * Check if a path should be excluded from metrics
 *
 * @param path - Request path
 * @param excludePaths - Paths to exclude
 * @returns true if path should be excluded
 */
function shouldExclude(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excludePath) => {
    if (excludePath.endsWith("*")) {
      return path.startsWith(excludePath.slice(0, -1));
    }
    return path === excludePath;
  });
}

/**
 * Express middleware for collecting HTTP metrics
 *
 * @param config - Metrics configuration
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { metricsMiddleware } from '@echo/metrics';
 *
 * app.use(metricsMiddleware({ serviceName: 'user-service' }));
 * ```
 */
export function metricsMiddleware(config: MetricsConfig): RequestHandler {
  // Initialize registry if not already done
  if (!isRegistryInitialized()) {
    initRegistry(config);
  }

  // Initialize HTTP metrics
  const enableHttpMetrics = config.httpMetrics ?? DEFAULT_CONFIG.httpMetrics;
  if (enableHttpMetrics) {
    initHttpMetrics();
  }

  const excludePaths = config.excludePaths ?? DEFAULT_CONFIG.excludePaths;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip excluded paths
    if (shouldExclude(req.path, excludePaths)) {
      next();
      return;
    }

    // Skip if HTTP metrics disabled
    if (!enableHttpMetrics) {
      next();
      return;
    }

    const method = req.method;
    const startTime = Date.now();

    // Track in-flight request
    const endInFlight = startHttpRequest(method);

    // Capture response finish
    res.on("finish", () => {
      endInFlight();

      const duration = Date.now() - startTime;
      const route = normalizeRoute(req);
      const statusCode = res.statusCode;

      recordHttpRequest(method, route, statusCode, duration);
    });

    next();
  };
}

/**
 * Express handler for /metrics endpoint
 * Returns Prometheus-formatted metrics
 *
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * import { metricsEndpoint } from '@echo/metrics';
 *
 * app.get('/metrics', metricsEndpoint());
 * ```
 */
export function metricsEndpoint(): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const registry = getRegistry();
      const metrics = await registry.metrics();

      res.set("Content-Type", registry.contentType);
      res.end(metrics);
    } catch (error) {
      console.error("[Metrics] Error generating metrics:", error);
      res.status(500).end("Error generating metrics");
    }
  };
}

/**
 * Get metrics as a string (for testing or custom endpoints)
 *
 * @returns Promise resolving to metrics string
 */
export async function getMetricsString(): Promise<string> {
  const registry = getRegistry();
  return registry.metrics();
}

/**
 * Get metrics content type header value
 *
 * @returns Content-Type header value for metrics
 */
export function getMetricsContentType(): string {
  return getRegistry().contentType;
}
