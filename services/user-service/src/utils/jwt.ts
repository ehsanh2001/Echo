import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JwtPayload, TokenPayload, TokenType } from "../types/jwt.types";

/**
 * JWT service for handling token creation and verification
 * Provides methods for generating and validating access and refresh tokens
 */
export class JWTService {
  private static secret = config.jwt.secret;
  private static accessTokenExpirySeconds = config.jwt.accessTokenExpirySeconds;
  private static refreshTokenExpirySeconds =
    config.jwt.refreshTokenExpirySeconds;

  /**
   * Verifies a JWT token and returns the decoded payload
   *
   * @param token - The JWT token to verify
   * @param expectedType - Optional expected token type for validation
   * @returns The decoded JWT payload containing user information
   * @throws Error with "TOKEN_EXPIRED" message if the token has expired
   * @throws Error with "INVALID_TOKEN" message if the token is invalid
   * @throws Error with "INVALID_TOKEN_TYPE" message if token type doesn't match expected
   * @example
   * ```typescript
   * try {
   *   const payload = JWTService.verifyToken(token, 'access');
   *   console.log("User ID:", payload.userId);
   * } catch (error) {
   *   console.error("Token verification failed:", error.message);
   * }
   * ```
   */
  static verifyToken(token: string, expectedType?: TokenType): JwtPayload {
    try {
      const payload = jwt.verify(token, this.secret) as JwtPayload;

      // Validate token type if expectedType is provided
      if (expectedType && payload.type !== expectedType) {
        throw new Error("INVALID_TOKEN_TYPE");
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("TOKEN_EXPIRED");
      }
      if (error instanceof Error && error.message === "INVALID_TOKEN_TYPE") {
        throw error;
      }
      throw new Error("INVALID_TOKEN");
    }
  }

  /**
   * Generates both access and refresh tokens for a user
   *
   * @param payload - The token payload containing user information
   * @returns An object containing both accessToken and refreshToken
   * @example
   * ```typescript
   * const tokenPayload = {
   *   userId: "123",
   *   email: "user@example.com",
   *   roles: ["user"]
   * };
   * const tokens = JWTService.generateTokenPair(tokenPayload);
   * console.log("Access Token:", tokens.accessToken);
   * console.log("Refresh Token:", tokens.refreshToken);
   * ```
   */
  static generateTokenPair(basePayload: Omit<TokenPayload, "type">): {
    accessToken: string;
    refreshToken: string;
  } {
    const now = Math.floor(Date.now() / 1000);

    const accessPayload: TokenPayload = { ...basePayload, type: "access" };
    const refreshPayload: TokenPayload = { ...basePayload, type: "refresh" };

    return {
      accessToken: this.createToken(
        accessPayload,
        now,
        this.accessTokenExpirySeconds
      ),
      refreshToken: this.createToken(
        refreshPayload,
        now + 1,
        this.refreshTokenExpirySeconds
      ), // Different timestamp for uniqueness
    };
  }

  /**
   * Creates a JWT token with specified timestamp and expiry time
   *
   * @param payload - The token payload containing user information
   * @param iat - The "issued at" timestamp (in seconds since epoch)
   * @param expiresInSeconds - The expiry time in seconds
   * @returns A signed JWT token string
   * @private
   */
  private static createToken(
    payload: TokenPayload,
    iat: number,
    expiresInSeconds: number
  ): string {
    return jwt.sign({ ...payload, iat }, this.secret, {
      expiresIn: expiresInSeconds,
    } as jwt.SignOptions);
  }

  /**
   * Generate expired token for testing
   */
  static generateExpiredToken(
    basePayload: Omit<TokenPayload, "type">,
    tokenType: TokenType = "access"
  ): string {
    const payload: TokenPayload = { ...basePayload, type: tokenType };
    return jwt.sign(
      { ...payload, iat: Math.floor(Date.now() / 1000) - 3600 }, // 1 hour ago
      this.secret,
      { expiresIn: "1s" } // Expired immediately
    );
  }
}
