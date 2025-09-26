import { Request, Response, NextFunction } from "express";
import { JWTService } from "../utils/jwt";
import { JwtPayload } from "../types/jwt.types";
import { UserServiceError } from "../types/error.types";

/**
 * Extended Express Request interface to include authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?:
    | {
        userId: string;
        email: string;
        roles: string[];
      }
    | undefined;
}

/**
 * Result of token validation
 */
interface TokenValidationResult {
  success: boolean;
  user?: {
    userId: string;
    email: string;
    roles: string[];
  };
  error?: {
    status: number;
    message: string;
    code: string;
  };
}

/**
 * Extracts Bearer token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Token string, empty string if format is valid but token is empty, or null if invalid format
 */
const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const tokenParts = authHeader.split(" ");
  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
    return null;
  }

  // Return the token part (which could be empty string)
  return tokenParts[1] ?? null;
};

/**
 * Validates JWT token and extracts user information
 *
 * @param authHeader - Authorization header value
 * @returns Validation result with user info or error
 */
const validateJwtToken = (
  authHeader: string | undefined
): TokenValidationResult => {
  // Check for missing auth header
  if (!authHeader) {
    return {
      success: false,
      error: {
        status: 401,
        message: "Authorization header is required",
        code: "MISSING_AUTH_HEADER",
      },
    };
  }

  // Extract token from Bearer header
  const token = extractBearerToken(authHeader);
  if (token === null) {
    return {
      success: false,
      error: {
        status: 401,
        message: "Invalid authorization header format. Use 'Bearer <token>'",
        code: "INVALID_AUTH_FORMAT",
      },
    };
  }

  if (token === "") {
    return {
      success: false,
      error: {
        status: 401,
        message: "Token is required",
        code: "MISSING_TOKEN",
      },
    };
  }

  try {
    // Verify the JWT token
    const payload = JWTService.verifyToken(token) as JwtPayload;

    return {
      success: true,
      user: {
        userId: payload.userId,
        email: payload.email,
        roles: payload.roles,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: getJwtError(error),
    };
  }
};

/**
 * Maps JWT errors to standardized error responses
 *
 * @param error - JWT verification error
 * @returns Standardized error object
 */
const getJwtError = (
  error: any
): { status: number; message: string; code: string } => {
  if (error.message === "TOKEN_EXPIRED") {
    return {
      status: 401,
      message: "Access token has expired",
      code: "TOKEN_EXPIRED",
    };
  }

  if (error.message === "INVALID_TOKEN") {
    return {
      status: 401,
      message: "Invalid access token",
      code: "INVALID_TOKEN",
    };
  }

  // Handle other errors
  console.error("JWT validation error:", error);
  return {
    status: 401,
    message: "Authentication failed",
    code: "AUTH_FAILED",
  };
};

/**
 * Sends error response for authentication failures
 *
 * @param res - Express response object
 * @param error - Error details
 */
const sendAuthError = (
  res: Response,
  error: { status: number; message: string; code: string }
): void => {
  res.status(error.status).json({
    success: false,
    message: error.message,
    code: error.code,
  });
};

/**
 * JWT Authentication middleware
 *
 * Validates JWT access tokens from the Authorization header and attaches
 * user information to the request object for use in protected routes.
 *
 * Transforms a regular Request into an AuthenticatedRequest by adding user info.
 *
 * @example
 * ```typescript
 * // Apply to specific routes
 * router.post('/logout', jwtAuth, UserController.logout);
 *
 * // Apply to multiple routes
 * router.use('/protected', jwtAuth);
 * ```
 */
export const jwtAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const validationResult = validateJwtToken(req.headers.authorization);

  if (!validationResult.success) {
    sendAuthError(res, validationResult.error!);
    return;
  }

  // Transform Request to AuthenticatedRequest by adding user property
  (req as AuthenticatedRequest).user = validationResult.user;
  next();
};

/**
 * Optional JWT Authentication middleware
 *
 * Similar to jwtAuth but doesn't fail if no token is provided.
 * Useful for endpoints that work for both authenticated and anonymous users.
 *
 * Transforms a regular Request into an AuthenticatedRequest by adding user info or undefined.
 *
 * @example
 * ```typescript
 * // User info will be available if token is provided, null otherwise
 * router.get('/public-profile/:id', optionalJwtAuth, ProfileController.getProfile);
 * ```
 */
export const optionalJwtAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const validationResult = validateJwtToken(req.headers.authorization);

  // Transform Request to AuthenticatedRequest by adding user property (or undefined)
  (req as AuthenticatedRequest).user = validationResult.success
    ? validationResult.user
    : undefined;
  next();
};

/**
 * Checks if user has any of the required roles
 *
 * @param userRoles - Roles that the user has
 * @param requiredRoles - Roles that are required for access
 * @returns True if user has at least one required role
 */
const hasRequiredRole = (
  userRoles: string[],
  requiredRoles: string[]
): boolean => {
  return requiredRoles.some((role) => userRoles.includes(role));
};

/**
 * Role-based authorization middleware factory
 *
 * Creates middleware that checks if the authenticated user has required roles.
 * Must be used after jwtAuth middleware.
 *
 * @param requiredRoles - Array of roles that are allowed access
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // Require admin role
 * router.delete('/admin/users/:id', jwtAuth, requireRoles(['admin']), AdminController.deleteUser);
 *
 * // Require admin or moderator role
 * router.post('/moderate', jwtAuth, requireRoles(['admin', 'moderator']), ModerationController.moderate);
 * ```
 */
export const requireRoles = (requiredRoles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      sendAuthError(res, {
        status: 401,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    if (!hasRequiredRole(req.user.roles, requiredRoles)) {
      sendAuthError(res, {
        status: 403,
        message: `Access denied. Required roles: ${requiredRoles.join(", ")}`,
        code: "INSUFFICIENT_PERMISSIONS",
      });
      return;
    }

    next();
  };
};
