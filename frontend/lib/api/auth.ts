import { apiClient } from "./client";
import {
  RegisterData,
  RegisterResponse,
  LoginData,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  ForgotPasswordData,
  ForgotPasswordResponse,
  ValidateResetTokenResponse,
  ResetPasswordData,
  ResetPasswordResponse,
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

/**
 * Request a password reset email
 *
 * Initiates the password reset flow by sending a reset link to the provided email.
 * Note: For security, always returns success even if email doesn't exist.
 *
 * @param data - Object containing the email address
 * @returns Promise resolving to response with generic success message
 *
 * @example
 * ```typescript
 * const result = await forgotPassword({ email: 'user@example.com' });
 * // Always shows generic message regardless of whether email exists
 * console.log(result.message); // "If an account exists..."
 * ```
 */
export async function forgotPassword(
  data: ForgotPasswordData
): Promise<ForgotPasswordResponse> {
  return await apiClient.post<ForgotPasswordResponse>(
    "/api/auth/forgot-password",
    data
  );
}

/**
 * Validate a password reset token
 *
 * Checks if the reset token is valid and not expired.
 * Call this when user lands on the reset password page.
 *
 * @param token - The password reset token from the URL
 * @returns Promise resolving to validation result with email if valid
 *
 * @example
 * ```typescript
 * const result = await validateResetToken('abc123...');
 * if (result.data?.valid) {
 *   console.log('Token valid for:', result.data.email);
 * } else {
 *   console.log('Token invalid or expired');
 * }
 * ```
 */
export async function validateResetToken(
  token: string
): Promise<ValidateResetTokenResponse> {
  return await apiClient.post<ValidateResetTokenResponse>(
    "/api/auth/validate-reset-token",
    { token }
  );
}

/**
 * Reset password using a valid token
 *
 * Completes the password reset process by setting a new password.
 * Invalidates all existing sessions on success.
 *
 * @param data - Object containing reset token and new password
 * @returns Promise resolving to success response
 * @throws {ApiError} When token is invalid/expired or password doesn't meet requirements
 *
 * @example
 * ```typescript
 * const result = await resetPassword({
 *   token: 'abc123...',
 *   newPassword: 'NewSecurePass123'
 * });
 * if (result.success) {
 *   // Redirect to login
 *   router.push('/login');
 * }
 * ```
 */
export async function resetPassword(
  data: ResetPasswordData
): Promise<ResetPasswordResponse> {
  return await apiClient.post<ResetPasswordResponse>(
    "/api/auth/reset-password",
    data
  );
}
