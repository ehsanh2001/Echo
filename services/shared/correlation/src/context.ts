/**
 * AsyncLocalStorage context management for request correlation
 *
 * Provides correlation ID and business context that travels through the call stack,
 * including async operations, without explicit parameter passing.
 *
 * Usage:
 * ```typescript
 * import { getCorrelationId, setUserId, updateContext } from '@echo/correlation';
 *
 * // In middleware - context is already created
 *
 * // In JWT auth middleware - set user context
 * setUserId(user.id);
 * setWorkspaceId(workspace.id);
 *
 * // Or bulk update
 * updateContext({ userId: user.id, workspaceId: workspace.id });
 *
 * // Anywhere in request handler - read context
 * const correlationId = getCorrelationId();
 * const userId = getUserId();
 * ```
 */

import { AsyncLocalStorage } from "async_hooks";
import { RequestContext, ContextUpdate } from "./types";

/**
 * AsyncLocalStorage instance for storing request context
 * This maintains context across async operations within a single request
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 * Returns undefined if called outside of a request context
 */
export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Get the correlation ID for the current request
 * @returns Correlation ID or undefined if not in request context
 */
export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}

/**
 * Get the user ID from the current request context
 * @returns User ID or undefined
 */
export function getUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

/**
 * Get the workspace ID from the current request context
 * @returns Workspace ID or undefined
 */
export function getWorkspaceId(): string | undefined {
  return requestContext.getStore()?.workspaceId;
}

/**
 * Get the channel ID from the current request context
 * @returns Channel ID or undefined
 */
export function getChannelId(): string | undefined {
  return requestContext.getStore()?.channelId;
}

/**
 * Get the HTTP method from the current request context
 * @returns HTTP method or undefined
 */
export function getMethod(): string | undefined {
  return requestContext.getStore()?.method;
}

/**
 * Get the request path from the current request context
 * @returns Request path or undefined
 */
export function getPath(): string | undefined {
  return requestContext.getStore()?.path;
}

/**
 * Get the client IP from the current request context
 * @returns Client IP or undefined
 */
export function getIp(): string | undefined {
  return requestContext.getStore()?.ip;
}

/**
 * Get the user agent from the current request context
 * @returns User agent or undefined
 */
export function getUserAgent(): string | undefined {
  return requestContext.getStore()?.userAgent;
}

/**
 * Set the user ID in the current request context
 * Typically called after JWT authentication
 *
 * @param userId - User ID to set
 */
export function setUserId(userId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
}

/**
 * Set the workspace ID in the current request context
 * Typically called when workspace context is determined
 *
 * @param workspaceId - Workspace ID to set
 */
export function setWorkspaceId(workspaceId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.workspaceId = workspaceId;
  }
}

/**
 * Set the channel ID in the current request context
 * Typically called when channel context is determined
 *
 * @param channelId - Channel ID to set
 */
export function setChannelId(channelId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.channelId = channelId;
  }
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
  const store = requestContext.getStore();
  if (store) {
    Object.assign(store, updates);
  }
}

/**
 * Check if we're currently inside a request context
 * @returns true if in request context, false otherwise
 */
export function hasContext(): boolean {
  return requestContext.getStore() !== undefined;
}
