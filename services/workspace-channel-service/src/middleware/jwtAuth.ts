import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { updateContext } from "@echo/correlation";
import { config } from "../config/env";
import logger from "../utils/logger";
import { JwtPayload } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

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
    throw WorkspaceChannelServiceError.unauthorized(
      "Authorization header is required"
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw WorkspaceChannelServiceError.unauthorized(
      'Authorization header must start with "Bearer "'
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token) {
    throw WorkspaceChannelServiceError.unauthorized("JWT token is required");
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
      throw WorkspaceChannelServiceError.unauthorized("JWT token has expired");
    } else if (jwtError.name === "JsonWebTokenError") {
      throw WorkspaceChannelServiceError.unauthorized("Invalid JWT token");
    } else {
      throw WorkspaceChannelServiceError.unauthorized(
        "JWT token verification failed"
      );
    }
  }
}

/**
 * Validates the structure and content of the decoded JWT payload
 */
function validateTokenPayload(decoded: any): void {
  if (!decoded || typeof decoded !== "object") {
    throw WorkspaceChannelServiceError.unauthorized(
      "Invalid JWT token payload"
    );
  }

  if (!decoded.userId || typeof decoded.userId !== "string") {
    throw WorkspaceChannelServiceError.unauthorized(
      "JWT token missing valid userId"
    );
  }

  if (!decoded.email || typeof decoded.email !== "string") {
    throw WorkspaceChannelServiceError.unauthorized(
      "JWT token missing valid email"
    );
  }

  if (!decoded.roles || !Array.isArray(decoded.roles)) {
    throw WorkspaceChannelServiceError.unauthorized(
      "JWT token missing valid roles"
    );
  }

  if (!decoded.type || decoded.type !== "access") {
    throw WorkspaceChannelServiceError.unauthorized(
      "JWT token missing valid type"
    );
  }
}

/**
 * Creates a structured user payload from decoded JWT token
 */
function createUserPayload(decoded: any): JwtPayload {
  return {
    userId: decoded.userId,
    email: decoded.email,
    roles: decoded.roles,
    type: decoded.type,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

/**
 * Handles authentication errors and sends appropriate responses
 */
function handleAuthError(error: unknown, res: Response): void {
  if (error instanceof WorkspaceChannelServiceError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      service: config.service.name,
      timestamp: new Date().toISOString(),
    });
  } else {
    logger.error("Unexpected error in JWT middleware", { error });
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Authentication failed due to server error",
      service: config.service.name,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * JWT Authentication middleware
 * Verifies JWT tokens locally using the shared secret
 * Attaches user info to request object on success
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    const decoded = verifyJwtToken(token);

    validateTokenPayload(decoded);

    const userPayload = createUserPayload(decoded);

    // Attach user to request
    (req as AuthenticatedRequest).user = userPayload;

    // Update correlation context with userId for all subsequent logs
    updateContext({ userId: userPayload.userId });

    logger.debug("User authenticated successfully", {
      email: userPayload.email,
      userId: userPayload.userId,
    });

    next();
  } catch (error) {
    handleAuthError(error, res);
  }
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticatedRequest(
  req: Request
): req is AuthenticatedRequest {
  return "user" in req && typeof (req as any).user === "object";
}
