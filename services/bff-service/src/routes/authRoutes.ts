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
 *   "displayName": "Display Name"
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
 *     "avatarUrl": null,
 *     "createdAt": "2025-10-25T...",
 *     "access_token": "jwt-token",
 *     "refresh_token": "jwt-refresh-token"
 *   }
 * }
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

export default authRoutes;
