import { apiClient } from "./client";
import {
  RegisterData,
  RegisterResponse,
  LoginData,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
} from "@/types/auth";

/**
 * Register a new user account
 *
 * Creates a new user account with the provided registration data.
 * Note: The backend returns only the user profile, not authentication tokens.
 * Users must log in separately after registration.
 *
 * @param data - Registration data including email, username, password, and optional displayName
 * @returns Promise resolving to the registration response with user profile
 * @throws {ApiError} When registration fails (e.g., email/username already exists)
 *
 * @example
 * ```typescript
 * const result = await registerUser({
 *   email: 'user@example.com',
 *   username: 'johndoe',
 *   password: 'SecurePass123',
 *   displayName: 'John Doe'
 * });
 *
 * if (result.success) {
 *   console.log('User created:', result.user);
 * }
 * ```
 */
export async function registerUser(
  data: RegisterData
): Promise<RegisterResponse> {
  return await apiClient.post<RegisterResponse>("/api/auth/register", data);
}

/**
 * Log in an existing user
 *
 * Authenticates a user with their email/username and password.
 * On success, returns access and refresh tokens that should be stored in localStorage.
 *
 * @param data - Login credentials (identifier can be email or username)
 * @returns Promise resolving to login response with tokens and user profile
 * @throws {ApiError} When authentication fails
 *
 * @example
 * ```typescript
 * const result = await loginUser({
 *   identifier: 'user@example.com',
 *   password: 'SecurePass123',
 *   rememberMe: true
 * });
 *
 * if (result.success && result.tokens) {
 *   localStorage.setItem('access_token', result.tokens.access_token);
 *   localStorage.setItem('refresh_token', result.tokens.refresh_token);
 * }
 * ```
 */
export async function loginUser(data: LoginData): Promise<LoginResponse> {
  return await apiClient.post<LoginResponse>("/api/auth/login", data);
}

/**
 * Log out the current user
 *
 * Notifies the server to invalidate the current session and clears local tokens.
 * Note: Requires the access_token in Authorization header (handled by apiClient).
 *
 * @returns Promise resolving to logout response
 * @throws {ApiError} When logout fails on the server
 *
 * @example
 * ```typescript
 * try {
 *   await logoutUser();
 *   // Tokens are cleared, redirect to login
 *   window.location.href = '/login';
 * } catch (error) {
 *   console.error('Logout failed:', error);
 * }
 * ```
 */
export async function logoutUser(): Promise<LogoutResponse> {
  return await apiClient.post<LogoutResponse>("/api/auth/logout", {});
}
