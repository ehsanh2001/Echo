/**
 * Type definitions for @echo/metrics
 */

/**
 * Configuration for metrics middleware
 */
export interface MetricsConfig {
  /**
   * Service name to include in metrics labels
   */
  serviceName: string;

  /**
   * Prefix for all custom metrics (default: 'echo_')
   */
  prefix?: string;

  /**
   * Enable default Node.js metrics (memory, CPU, event loop, etc.)
   * Default: true
   */
  defaultMetrics?: boolean;

  /**
   * Default metrics collection interval in milliseconds
   * Default: 10000 (10 seconds)
   */
  defaultMetricsInterval?: number;

  /**
   * Enable HTTP request metrics
   * Default: true
   */
  httpMetrics?: boolean;

  /**
   * Paths to exclude from HTTP metrics (e.g., health checks)
   * Default: ['/health', '/ready', '/metrics']
   */
  excludePaths?: string[];

  /**
   * Custom labels to add to all metrics
   */
  customLabels?: Record<string, string>;

  /**
   * Histogram buckets for request duration (in seconds)
   * Default: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
   */
  durationBuckets?: number[];
}

/**
 * HTTP metrics labels
 */
export interface HttpMetricLabels {
  method: string;
  route: string;
  status_code: string;
  service: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
  Omit<MetricsConfig, "serviceName" | "customLabels">
> & { customLabels: Record<string, string> } = {
  prefix: "echo_",
  defaultMetrics: true,
  defaultMetricsInterval: 10000,
  httpMetrics: true,
  excludePaths: ["/health", "/ready", "/metrics"],
  customLabels: {},
  durationBuckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
};
