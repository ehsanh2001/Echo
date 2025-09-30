import {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from "../../types/auth.types";

export interface IAuthService {
  /**
   * Authenticates a user and returns JWT tokens
   *
   * @param data - Login credentials (email/username and password)
   * @returns Promise resolving to login response with tokens and user profile
   */
  loginUser(data: LoginRequest): Promise<LoginResponse>;

  /**
   * Refreshes JWT tokens using a valid refresh token
   *
   * @param refreshToken - Valid refresh token from previous login/refresh
   * @returns Promise resolving to new tokens
   */
  refreshToken(refreshToken: string): Promise<RefreshResponse>;

  /**
   * Logs out a user by invalidating their refresh token
   *
   * @param userId - User ID to logout
   * @returns Promise that resolves when logout is complete
   */
  logoutUser(userId: string): Promise<void>;
}
