import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Socket } from "socket.io";
import { config } from "../config/env";
import logger from "../utils/logger";

/**
 * Extended Express Request interface with authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roles: string[];
  };
}

/**
 * JWT Payload structure (matches user-service)
 */
interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

/**
 * Extended Socket.IO Socket with authenticated user information
 */
export interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    email: string;
    roles: string[];
  };
}

/**
 * Extract Bearer token from Authorization header
 */
const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1] || null;
};

/**
 * Verify JWT token and extract payload
 */
const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Validate token type
    if (decoded.type !== "access") {
      throw new Error("INVALID_TOKEN_TYPE");
    }

    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new Error("TOKEN_EXPIRED");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("INVALID_TOKEN");
    }
    throw error;
  }
};

/**
 * JWT Authentication Middleware for HTTP routes
 *
 * Validates JWT access tokens and attaches user info to the request.
 *
 * @example
 * ```typescript
 * router.get('/protected', jwtAuth, (req: AuthenticatedRequest, res) => {
 *   const userId = req.user?.userId;
 *   // ...
 * });
 * ```
 */
export const jwtAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    // Check for missing auth header
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "Authorization header is required",
        code: "MISSING_AUTH_HEADER",
      });
      return;
    }

    // Extract token
    const token = extractBearerToken(authHeader);
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Invalid authorization header format. Use 'Bearer <token>'",
        code: "INVALID_AUTH_FORMAT",
      });
      return;
    }

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to request
    (req as AuthenticatedRequest).user = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
    };

    next();
  } catch (error: any) {
    logger.warn("JWT authentication failed", {
      error: error.message,
      path: req.path,
    });

    if (error.message === "TOKEN_EXPIRED") {
      res.status(401).json({
        success: false,
        message: "Access token has expired",
        code: "TOKEN_EXPIRED",
      });
      return;
    }

    if (error.message === "INVALID_TOKEN") {
      res.status(401).json({
        success: false,
        message: "Invalid access token",
        code: "INVALID_TOKEN",
      });
      return;
    }

    if (error.message === "INVALID_TOKEN_TYPE") {
      res.status(401).json({
        success: false,
        message: "Token type mismatch. Expected access token",
        code: "INVALID_TOKEN_TYPE",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed",
      code: "AUTH_FAILED",
    });
  }
};

/**
 * Socket.IO Authentication Middleware
 *
 * Validates JWT access tokens for Socket.IO connections.
 * Token can be provided via:
 * - Query parameter: ?token=<jwt>
 * - Auth object: { auth: { token: '<jwt>' } }
 *
 * @example
 * ```typescript
 * // In index.ts
 * io.use(socketAuth);
 *
 * io.on('connection', (socket: AuthenticatedSocket) => {
 *   const userId = socket.user?.userId;
 *   // Join user-specific room
 *   socket.join(`user:${userId}`);
 * });
 * ```
 */
export const socketAuth = (
  socket: Socket,
  next: (err?: Error) => void
): void => {
  try {
    // Extract token from query or auth
    const token = socket.handshake.query.token || socket.handshake.auth.token;

    if (!token || typeof token !== "string") {
      logger.warn("Socket connection rejected: Missing token", {
        socketId: socket.id,
      });
      next(new Error("MISSING_TOKEN"));
      return;
    }

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to socket
    (socket as AuthenticatedSocket).user = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
    };

    logger.info("Socket authenticated", {
      socketId: socket.id,
      userId: payload.userId,
    });

    next();
  } catch (error: any) {
    logger.warn("Socket authentication failed", {
      socketId: socket.id,
      error: error.message,
    });

    if (error.message === "TOKEN_EXPIRED") {
      next(new Error("TOKEN_EXPIRED"));
      return;
    }

    if (error.message === "INVALID_TOKEN") {
      next(new Error("INVALID_TOKEN"));
      return;
    }

    if (error.message === "INVALID_TOKEN_TYPE") {
      next(new Error("INVALID_TOKEN_TYPE"));
      return;
    }

    next(new Error("AUTH_FAILED"));
  }
};
