import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { jwtAuth, jwtRefreshAuth } from "../middleware/auth";

/**
 * Authentication routes
 * Base path: /api/auth
 *
 * These routes forward authentication requests to the user service,
 * providing a unified API gateway for the frontend.
 */
const authRoutes = Router();

/**
 * POST /api/auth/register
 * Register a new user
 *
 * Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecureP@ssw0rd",
 *   "username": "username",
 *   "displayName": "Display Name"  // Optional, defaults to username
 *   "bio": "User bio"              // Optional
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "message": "User registered successfully",
 *   "data": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "username": "username",
 *     "displayName": "Display Name",
 *     "bio": "User bio" | null,
 *     "avatarUrl": null,
 *     "createdAt": "2025-10-25T...",
 *     "lastSeen": null,
 *     "roles": ["user"]
 *   }
 * }
 *
 * Note: Registration does NOT return tokens. User must login separately.
 */
authRoutes.post("/register", AuthController.register);

/**
 * POST /api/auth/login
 * Login user
 *
 * Body:
 * {
 *   "identifier": "user@example.com",  // email or username
 *   "password": "SecureP@ssw0rd"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "access_token": "jwt-access-token",
 *     "refresh_token": "jwt-refresh-token",
 *     "user": {
 *       "id": "uuid",
 *       "email": "user@example.com",
 *       "username": "username",
 *       "displayName": "Display Name",
 *       "avatarUrl": null
 *     }
 *   }
 * }
 */
authRoutes.post("/login", AuthController.login);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 *
 * Headers:
 *   Authorization: Bearer <refresh-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Token refreshed successfully",
 *   "data": {
 *     "access_token": "new-jwt-access-token",
 *     "refresh_token": "new-jwt-refresh-token"
 *   }
 * }
 */
authRoutes.post("/refresh", jwtRefreshAuth, AuthController.refresh);

/**
 * POST /api/auth/logout
 * Logout user (invalidate tokens)
 *
 * Headers:
 *   Authorization: Bearer <access-token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Logout successful"
 * }
 */
authRoutes.post("/logout", jwtAuth, AuthController.logout);

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 *
 * Body:
 * {
 *   "email": "user@example.com"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "If an account exists with this email, we've sent a password reset link"
 * }
 *
 * Note: Always returns success for security (prevents email enumeration)
 */
authRoutes.post("/forgot-password", AuthController.forgotPassword);

/**
 * POST /api/auth/validate-reset-token
 * Validate a password reset token
 *
 * Body:
 * {
 *   "token": "reset-token-from-email"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "valid": true,
 *     "email": "u***@example.com"  // Masked email
 *   }
 * }
 */
authRoutes.post("/validate-reset-token", AuthController.validateResetToken);

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token
 *
 * Body:
 * {
 *   "token": "reset-token-from-email",
 *   "newPassword": "NewSecureP@ssw0rd"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Password reset successfully"
 * }
 */
authRoutes.post("/reset-password", AuthController.resetPassword);

export default authRoutes;
