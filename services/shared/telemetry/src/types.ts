/**
 * Telemetry configuration types
 */

/**
 * Request context stored in OTel context
 * Contains business data that travels through the call stack
 */
export interface RequestContext {
  /**
   * Timestamp when the request was received
   */
  timestamp: Date;

  /**
   * HTTP method (GET, POST, etc.)
   */
  method?: string;

  /**
   * Request path/URL
   */
  path?: string;

  /**
   * Client IP address
   */
  ip?: string;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Authenticated user ID (set after JWT verification)
   */
  userId?: string;

  /**
   * Current workspace ID (set from request context)
   */
  workspaceId?: string;

  /**
   * Current channel ID (set from request context)
   */
  channelId?: string;
}

/**
 * Partial context for bulk updates
 */
export type ContextUpdate = Partial<Omit<RequestContext, "timestamp">>;

export interface TelemetryConfig {
  /**
   * Service name for traces
   */
  serviceName: string;

  /**
   * Service version (optional, reads from package.json)
   */
  serviceVersion?: string;

  /**
   * Instance ID for distributed systems
   */
  instanceId: string;

  /**
   * OTLP endpoint for trace export
   */
  otlpEndpoint: string;

  /**
   * Deployment environment (development, staging, production)
   */
  environment: string;

  /**
   * Sampling ratio (0.0 - 1.0)
   * 1.0 = 100% of traces, 0.2 = 20% of traces
   */
  sampleRatio: number;

  /**
   * Enable debug logging for OTel SDK
   */
  debug: boolean;
}

export interface TelemetryOptions {
  /**
   * Override service name (otherwise uses OTEL_SERVICE_NAME env var)
   */
  serviceName?: string;

  /**
   * Service version
   */
  serviceVersion?: string;

  /**
   * Override sample ratio (otherwise uses OTEL_SAMPLE_RATIO env var)
   */
  sampleRatio?: number;

  /**
   * Enable debug mode
   */
  debug?: boolean;
}
