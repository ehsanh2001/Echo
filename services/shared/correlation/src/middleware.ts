/**
 * Express middleware for request correlation
 *
 * Creates AsyncLocalStorage context with correlation ID and request metadata.
 * The correlation ID is either:
 * 1. Read from X-Request-ID header (if provided by client or upstream service)
 * 2. Generated as a new UUID
 *
 * The correlation ID is set in response headers for client/upstream to use.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { correlationMiddleware } from '@echo/correlation';
 *
 * const app = express();
 * app.use(correlationMiddleware('user-service'));
 * ```
 */

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { requestContext } from "./context";
import { RequestContext } from "./types";

/**
 * Create correlation middleware for Express
 *
 * @param serviceName - Name of the service (for logging purposes)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.use(correlationMiddleware('user-service'));
 * ```
 */
export function correlationMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract or generate correlation ID
      const correlationId =
        (req.headers["x-request-id"] as string) ||
        (req.headers["x-correlation-id"] as string) ||
        uuidv4();

      // Set correlation ID in response headers
      res.setHeader("X-Request-ID", correlationId);
      res.setHeader("X-Correlation-ID", correlationId);

      // Extract request metadata
      const method = req.method;
      const path = req.path || req.url;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      // Create request context
      const context: RequestContext = {
        correlationId,
        timestamp: new Date(),
        method,
        path,
        ip,
        userAgent,
      };

      // Run the rest of the request in AsyncLocalStorage context
      requestContext.run(context, () => {
        next();
      });
    } catch (error) {
      // Fail silently - don't break the request due to correlation issues
      console.error(`[${serviceName}] Correlation middleware error:`, error);

      const fallbackId = uuidv4();
      // Try to set headers, but don't fail if headers already sent
      try {
        res.setHeader("X-Request-ID", fallbackId);
        res.setHeader("X-Correlation-ID", fallbackId);
      } catch (headerError) {
        // Headers already sent or response in invalid state - ignore
      }

      requestContext.run(
        {
          correlationId: fallbackId,
          timestamp: new Date(),
        },
        () => {
          next();
        }
      );
    }
  };
}

/**
 * Middleware to extract user context from authenticated request
 * Should be used AFTER JWT authentication middleware
 *
 * Expects req.user to have userId property
 *
 * @example
 * ```typescript
 * import { AuthenticatedRequest } from './types';
 * import { userContextMiddleware } from '@echo/correlation';
 *
 * app.use(jwtAuth); // Sets req.user
 * app.use(userContextMiddleware());
 * ```
 */
export function userContextMiddleware() {
  return (req: any, res: Response, next: NextFunction): void => {
    try {
      const store = requestContext.getStore();
      if (store && req.user?.userId) {
        store.userId = req.user.userId;
      }
      next();
    } catch (error) {
      // Fail silently
      next();
    }
  };
}
