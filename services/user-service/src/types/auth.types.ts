/**
 * Authentication-related request and response types
 *
 * This module defines TypeScript interfaces for authentication endpoints,
 * including registration, login, and token refresh operations.
 */

import { UserProfile } from "./user.types";

/**
 * User registration request payload
 *
 * Contains all required and optional fields for creating a new user account.
 *
 */
export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName?: string;
  bio?: string;
}

/**
 * User login request payload
 *
 * Supports login with either email or username as identifier.
 *
 */
export interface LoginRequest {
  identifier: string; // email or username
  password: string;
}

/**
 * User registration response payload
 *
 * Contains basic user information returned after successful registration.
 *
 */
export interface RegisterResponse {
  id: string;
  email: string;
  username: string;
  display_name: string;
  email_verified: boolean;
}

/**
 * User login response payload
 *
 * Contains JWT tokens and user profile returned after successful authentication.
 *
 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserProfile;
}

/**
 * Token refresh response payload
 *
 * Contains new JWT tokens returned after successful token refresh.
 *
 */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
