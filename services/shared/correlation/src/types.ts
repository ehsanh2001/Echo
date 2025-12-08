/**
 * Type definitions for correlation context
 */

/**
 * Request context stored in AsyncLocalStorage
 * Contains correlation ID and business context that travels through the call stack
 */
export interface RequestContext {
  /**
   * Unique identifier for this request, propagated across service boundaries
   */
  correlationId: string;

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

  /**
   * OpenTelemetry trace ID (will be added in Phase 4)
   */
  traceId?: string;

  /**
   * OpenTelemetry span ID (will be added in Phase 4)
   */
  spanId?: string;
}

/**
 * Partial context for bulk updates
 */
export type ContextUpdate = Partial<
  Omit<RequestContext, "correlationId" | "timestamp">
>;
