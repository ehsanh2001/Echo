// Authentication related types

/**
 * User registration data
 *
 * Contains all information required to create a new user account.
 * Display name is optional and will default to username if not provided.
 */
export interface RegisterData {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

/**
 * Registration API response
 *
 * Note: Registration does not return authentication tokens.
 * Users must log in separately after successful registration.
 */
export interface RegisterResponse {
  success: boolean;
  message: string;
  /** Created user profile (only present on success) */
  data?: UserProfile;
}

/**
 * User profile information
 *
 * Contains all public information about a user.
 * Matches the UserProfile type from user-service.
 */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  /** Timestamp when the user was last seen */
  lastSeen: string | null;
  /** User's roles (e.g., ["user"], ["admin"]) */
  roles: string[];
}

/**
 * User login credentials
 */
export interface LoginData {
  /** Email address or username */
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login API response
 *
 * Contains authentication tokens and user profile on successful login.
 * Note: Backend returns data object with access_token, refresh_token, expires_in, and user.
 */
export interface LoginResponse {
  success: boolean;
  /** Human-readable message about the login result */
  message: string;
  /** Login data (only present on success) */
  data?: {
    access_token: string;
    refresh_token: string;
    /** Token expiration time in seconds */
    expires_in: number;
    user: UserProfile;
  };
}

/**
 * Password validation results
 *
 * Tracks which password requirements have been met.
 */
export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  differentFromUsername: boolean;
}

/**
 * Complete validation result with score
 *
 * Provides an overall assessment of password strength.
 */
export interface ValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
}
