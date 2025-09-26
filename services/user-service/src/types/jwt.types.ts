/**
 * JWT-related types and interfaces
 *
 * This module defines TypeScript interfaces for JWT token handling,
 * including token payloads and JWT claims.
 */

/**
 * JWT token payload for token generation
 *
 * Contains user information embedded in JWT tokens for authentication
 * and authorization purposes.
 *
 */
export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

/**
 * Complete JWT payload including standard JWT fields
 *
 * Extends TokenPayload with standard JWT claims like issued at (iat)
 * and expiration time (exp) for token validation.
 *
 */
export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}
