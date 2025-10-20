import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JwtPayload } from "../types";
import { MessageServiceError } from "../utils/errors";

/**
 * Extended Request interface to include user information
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Extracts and validates JWT token from Authorization header
 */
function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader) {
    throw MessageServiceError.unauthorized("Authorization header is required");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw MessageServiceError.unauthorized(
      'Authorization header must start with "Bearer "'
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token) {
    throw MessageServiceError.unauthorized("JWT token is required");
  }

  return token;
}

/**
 * Verifies JWT token and handles different error types
 */
function verifyJwtToken(token: string): any {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (jwtError: any) {
    if (jwtError.name === "TokenExpiredError") {
      throw MessageServiceError.unauthorized("JWT token has expired");
    } else if (jwtError.name === "JsonWebTokenError") {
      throw MessageServiceError.unauthorized("Invalid JWT token");
    } else {
      throw MessageServiceError.unauthorized("JWT token verification failed");
    }
  }
}

/**
 * Validates the structure and content of the decoded JWT payload
 */
function validateTokenPayload(decoded: any): void {
  if (!decoded || typeof decoded !== "object") {
    throw MessageServiceError.unauthorized("Invalid JWT token payload");
  }

  if (!decoded.userId || typeof decoded.userId !== "string") {
    throw MessageServiceError.unauthorized("JWT token missing valid userId");
  }

  if (!decoded.email || typeof decoded.email !== "string") {
    throw MessageServiceError.unauthorized("JWT token missing valid email");
  }

  if (!decoded.roles || !Array.isArray(decoded.roles)) {
    throw MessageServiceError.unauthorized("JWT token missing valid roles");
  }

  if (!decoded.type || decoded.type !== "access") {
    throw MessageServiceError.unauthorized("JWT token missing valid type");
  }
}

/**
 * JWT Authentication Middleware
 *
 * Validates JWT token from Authorization header and attaches user info to request
 *
 * Usage:
 * ```typescript
 * router.post('/messages', jwtAuth, async (req: AuthenticatedRequest, res) => {
 *   const userId = req.user.userId;
 *   // ...
 * });
 * ```
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from header
    const token = extractTokenFromHeader(req.headers.authorization);

    // Verify token signature
    const decoded = verifyJwtToken(token);

    // Validate token payload structure
    validateTokenPayload(decoded);

    // Attach user info to request
    (req as AuthenticatedRequest).user = decoded as JwtPayload;

    console.log(`✅ Authenticated user: ${decoded.userId} (${decoded.email})`);

    next();
  } catch (error) {
    if (error instanceof MessageServiceError) {
      console.error(`❌ Authentication failed: ${error.message}`);
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error("❌ Unexpected authentication error:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Internal server error during authentication",
          code: "INTERNAL_ERROR",
          statusCode: 500,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
