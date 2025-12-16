/**
 * OTel Context-based Request Context Management
 *
 * Uses OpenTelemetry's context API (backed by AsyncLocalStorage) to store
 * business context (userId, workspaceId, channelId) alongside trace context.
 *
 * This replaces the separate @echo/correlation package by consolidating
 * all request context into OTel's context mechanism.
 *
 * Key differences from @echo/correlation:
 * - No correlationId field (use getTraceId() instead)
 * - Uses OTel context instead of separate AsyncLocalStorage
 * - Context is immutable; updates create new context
 *
 * Usage:
 * ```typescript
 * import {
 *   requestContextMiddleware,
 *   setUserId,
 *   getUserId,
 *   getTraceId
 * } from '@echo/telemetry';
 *
 * // In app setup
 * app.use(requestContextMiddleware());
 *
 * // In auth middleware
 * setUserId(user.id);
 *
 * // In route handlers
 * const userId = getUserId();
 * const traceId = getTraceId(); // Replaces correlationId
 * ```
 */

import { context, createContextKey, Context } from "@opentelemetry/api";
import type { Request, Response, NextFunction } from "express";
import { RequestContext, ContextUpdate } from "./types";

/**
 * Symbol-based context key for storing request context in OTel context
 */
const REQUEST_CONTEXT_KEY = createContextKey("echo.requestContext");

/**
 * Get the current request context
 * Returns undefined if called outside of a request context
 */
export function getRequestContext(): RequestContext | undefined {
  return context.active().getValue(REQUEST_CONTEXT_KEY) as
    | RequestContext
    | undefined;
}

/**
 * Check if we're currently inside a request context
 * @returns true if in request context, false otherwise
 */
export function hasContext(): boolean {
  return getRequestContext() !== undefined;
}

/**
 * Get the user ID from the current request context
 * @returns User ID or undefined
 */
export function getUserId(): string | undefined {
  return getRequestContext()?.userId;
}

/**
 * Get the workspace ID from the current request context
 * @returns Workspace ID or undefined
 */
export function getWorkspaceId(): string | undefined {
  return getRequestContext()?.workspaceId;
}

/**
 * Get the channel ID from the current request context
 * @returns Channel ID or undefined
 */
export function getChannelId(): string | undefined {
  return getRequestContext()?.channelId;
}

/**
 * Get the HTTP method from the current request context
 * @returns HTTP method or undefined
 */
export function getMethod(): string | undefined {
  return getRequestContext()?.method;
}

/**
 * Get the request path from the current request context
 * @returns Request path or undefined
 */
export function getPath(): string | undefined {
  return getRequestContext()?.path;
}

/**
 * Get the client IP from the current request context
 * @returns Client IP or undefined
 */
export function getIp(): string | undefined {
  return getRequestContext()?.ip;
}

/**
 * Get the user agent from the current request context
 * @returns User agent or undefined
 */
export function getUserAgent(): string | undefined {
  return getRequestContext()?.userAgent;
}

/**
 * Internal: Update request context with new values
 * Since OTel context is immutable, this creates a new context and binds it
 *
 * NOTE: This uses a workaround because OTel context is immutable.
 * We store a mutable object reference in the context, allowing updates
 * without needing to rewrap the entire call stack.
 */
function updateRequestContext(updates: ContextUpdate): void {
  const current = getRequestContext();
  if (current) {
    // Since we store a mutable object reference, we can update it directly
    // This is the key insight: the context key points to a mutable object
    Object.assign(current, updates);
  }
}

/**
 * Set the user ID in the current request context
 * Typically called after JWT authentication
 *
 * @param userId - User ID to set
 */
export function setUserId(userId: string): void {
  updateRequestContext({ userId });
}

/**
 * Set the workspace ID in the current request context
 * Typically called when workspace context is determined
 *
 * @param workspaceId - Workspace ID to set
 */
export function setWorkspaceId(workspaceId: string): void {
  updateRequestContext({ workspaceId });
}

/**
 * Set the channel ID in the current request context
 * Typically called when channel context is determined
 *
 * @param channelId - Channel ID to set
 */
export function setChannelId(channelId: string): void {
  updateRequestContext({ channelId });
}

/**
 * Bulk update request context
 * Useful for setting multiple context values at once
 *
 * @param updates - Partial context to merge into current context
 *
 * @example
 * ```typescript
 * updateContext({
 *   userId: '123',
 *   workspaceId: '456',
 *   channelId: '789'
 * });
 * ```
 */
export function updateContext(updates: ContextUpdate): void {
  updateRequestContext(updates);
}

/**
 * Express middleware that creates request context using OTel context
 *
 * This middleware:
 * 1. Creates a RequestContext object with request metadata
 * 2. Stores it in OTel's context (same context that holds trace info)
 * 3. Runs the rest of the middleware chain within this context
 *
 * Note: OTel's HTTP instrumentation already creates a span and runs
 * handlers within context.with(). This middleware adds our business
 * context to that same context.
 *
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { requestContextMiddleware } from '@echo/telemetry';
 *
 * const app = express();
 * app.use(requestContextMiddleware());
 * ```
 */
export function requestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Create mutable request context object
    const requestCtx: RequestContext = {
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get("user-agent"),
      // userId, workspaceId, channelId will be set by subsequent middleware
    };

    // Add request context to OTel context
    const newContext = context
      .active()
      .setValue(REQUEST_CONTEXT_KEY, requestCtx);

    // Run the rest of the request within this context
    context.with(newContext, () => {
      next();
    });
  };
}

/**
 * Middleware to extract and set user context from authenticated request
 * Use this after your JWT verification middleware
 *
 * @param userIdExtractor - Function to extract userId from request
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.use(jwtMiddleware); // Sets req.user
 * app.use(userContextMiddleware((req) => req.user?.userId));
 * ```
 */
export function userContextMiddleware(
  userIdExtractor: (req: Request) => string | undefined
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userId = userIdExtractor(req);
    if (userId) {
      setUserId(userId);
    }
    next();
  };
}

/**
 * Run a function within a request context
 * Useful for background jobs or tests that need request context
 *
 * @param requestCtx - The request context to use
 * @param fn - Function to run within the context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await runWithContext(
 *   { userId: 'user-123', timestamp: new Date() },
 *   async () => {
 *     const userId = getUserId(); // Returns 'user-123'
 *     return await processJob();
 *   }
 * );
 * ```
 */
export function runWithContext<T>(
  requestCtx: Partial<RequestContext>,
  fn: () => T
): T {
  const fullContext: RequestContext = {
    timestamp: new Date(),
    ...requestCtx,
  };

  const newContext = context
    .active()
    .setValue(REQUEST_CONTEXT_KEY, fullContext);
  return context.with(newContext, fn);
}

/**
 * Run an async function within a request context
 * Useful for background jobs or tests that need request context
 *
 * @param requestCtx - The request context to use
 * @param fn - Async function to run within the context
 * @returns Promise with result of the function
 */
export async function runWithContextAsync<T>(
  requestCtx: Partial<RequestContext>,
  fn: () => Promise<T>
): Promise<T> {
  const fullContext: RequestContext = {
    timestamp: new Date(),
    ...requestCtx,
  };

  const newContext = context
    .active()
    .setValue(REQUEST_CONTEXT_KEY, fullContext);
  return context.with(newContext, fn);
}
