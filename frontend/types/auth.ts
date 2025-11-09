// Authentication related types

/**
 * User registration data
 *
 * Contains all information required to create a new user account.
 * Display name is optional and will default to username if not provided.
 */
export interface RegisterData {
  /** User's email address (must be unique) */
  email: string;
  /** User's password (min 8 chars, must include upper, lower, number, different from username) */
  password: string;
  /** User's username (must be unique, alphanumeric with hyphens/underscores) */
  username: string;
  /** Optional display name shown to other users */
  displayName?: string;
}

/**
 * Registration API response
 *
 * Note: Registration does not return authentication tokens.
 * Users must log in separately after successful registration.
 */
export interface RegisterResponse {
  /** Whether the registration was successful */
  success: boolean;
  /** Human-readable message about the registration result */
  message: string;
  /** Created user profile (only present on success) */
  user?: UserProfile;
}

/**
 * User profile information
 *
 * Contains all public information about a user.
 */
export interface UserProfile {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's username */
  username: string;
  /** User's display name (defaults to username if not set) */
  displayName?: string;
  /** Timestamp when the user account was created */
  createdAt: string;
  /** Timestamp when the user account was last updated */
  updatedAt: string;
}

/**
 * User login credentials
 */
export interface LoginData {
  /** Email address or username */
  identifier: string;
  /** User's password */
  password: string;
  /** Whether to extend the session duration (optional) */
  rememberMe?: boolean;
}

/**
 * Login API response
 *
 * Contains authentication tokens and user profile on successful login.
 */
export interface LoginResponse {
  /** Whether the login was successful */
  success: boolean;
  /** Human-readable message about the login result */
  message: string;
  /** Authentication tokens (only present on success) */
  tokens?: {
    /** JWT access token for authenticated requests */
    access_token: string;
    /** JWT refresh token for obtaining new access tokens */
    refresh_token: string;
  };
  /** User profile information (only present on success) */
  user?: UserProfile;
}

/**
 * Password validation results
 *
 * Tracks which password requirements have been met.
 */
export interface PasswordValidation {
  /** Password is at least 8 characters */
  minLength: boolean;
  /** Password contains at least one uppercase letter */
  hasUppercase: boolean;
  /** Password contains at least one lowercase letter */
  hasLowercase: boolean;
  /** Password contains at least one number */
  hasNumbers: boolean;
  /** Password is different from username */
  differentFromUsername: boolean;
}

/**
 * Complete validation result with score
 *
 * Provides an overall assessment of password strength.
 */
export interface ValidationResult {
  /** Whether the password meets all requirements */
  isValid: boolean;
  /** Password strength score (0-5 scale) */
  score: number;
  /** List of validation error messages */
  errors: string[];
}
