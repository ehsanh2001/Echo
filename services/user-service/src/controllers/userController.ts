import { Request, Response } from "express";
import { container } from "../container";
import logger from "../utils/logger";
import { IUserService } from "../interfaces/services/IUserService";
import { IAuthService } from "../interfaces/services/IAuthService";
import { IPasswordResetService } from "../interfaces/services/IPasswordResetService";
import { LoginRequest } from "../types/auth.types";
import { RegisterRequest } from "../types/user.types";
import { UserServiceError } from "../types/error.types";
import { AuthenticatedRequest } from "../middleware/jwtAuth";

export class UserController {
  private static userService = container.resolve<IUserService>("IUserService");
  private static authService = container.resolve<IAuthService>("IAuthService");
  private static passwordResetService =
    container.resolve<IPasswordResetService>("IPasswordResetService");
  /**
   * POST /auth/register
   */
  static register = async (req: Request, res: Response): Promise<void> => {
    try {
      const userData: RegisterRequest = req.body;
      const result = await UserController.userService.registerUser(userData);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      UserController.handleError(error, res, "Registration");
    }
  };

  /**
   * POST /auth/login
   */
  static login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result = await UserController.authService.loginUser(loginData);

      res.json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      UserController.handleError(error, res, "Login");
    }
  };

  /**
   * POST /auth/refresh
   * Requires jwtRefreshAuth middleware (refresh token in Authorization header)
   */
  static refresh = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Valid refresh token required",
          code: "AUTH_REQUIRED",
        });
        return;
      }

      // Extract refresh token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({
          success: false,
          message: "Refresh token is required in Authorization header",
          code: "MISSING_REFRESH_TOKEN",
        });
        return;
      }

      const refreshToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      const result =
        await UserController.authService.refreshToken(refreshToken);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: result,
      });
    } catch (error) {
      UserController.handleError(error, res, "Token refresh");
    }
  };

  /**
   * POST /auth/logout
   * Requires JWT authentication middleware
   */
  static logout = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      // Get userId from JWT middleware (req.user is set by jwtAuth middleware)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        });
        return;
      }

      await UserController.authService.logoutUser(req.user.userId);

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      UserController.handleError(error, res, "Logout");
    }
  };

  /**
   * GET /users/:id
   * Public profile lookup - no authentication required
   */
  static getPublicProfile = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const profile = await UserController.userService.getPublicProfile(id);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      UserController.handleError(error, res, "Get public profile");
    }
  };

  /**
   * GET /users/searchbyemail/:email
   * Public profile lookup by email - no authentication required
   * Used for user discovery and invitation flows
   */
  static getPublicProfileByEmail = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { email } = req.params;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const profile =
        await UserController.userService.getPublicProfileByEmail(email);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      UserController.handleError(error, res, "Get public profile by email");
    }
  };

  /**
   * POST /users/batch
   * Batch fetch user profiles by IDs - no authentication required
   * Used by other services to enrich user data
   */
  static getUsersByIds = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds)) {
        res.status(400).json({
          success: false,
          message: "userIds array is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      if (userIds.length === 0) {
        res.status(200).json({
          success: true,
          data: [],
        });
        return;
      }

      // Limit batch size to prevent abuse
      if (userIds.length > 100) {
        res.status(400).json({
          success: false,
          message: "Maximum 100 user IDs allowed per request",
          code: "BATCH_SIZE_EXCEEDED",
        });
        return;
      }

      const profiles = await UserController.userService.getUsersByIds(userIds);

      res.status(200).json({
        success: true,
        data: profiles,
      });
    } catch (error) {
      UserController.handleError(error, res, "Get users by IDs");
    }
  };

  /**
   * POST /auth/forgot-password
   * Public endpoint - no authentication required
   */
  static forgotPassword = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        res.status(400).json({
          success: false,
          message: "Email is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: "Invalid email format",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      await UserController.passwordResetService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message:
          "If an account exists with this email, we've sent a password reset link",
      });
    } catch (error) {
      // Log but still return success to prevent enumeration
      logger.error("Forgot password error", { error });
      res.json({
        success: true,
        message:
          "If an account exists with this email, we've sent a password reset link",
      });
    }
  };

  /**
   * POST /auth/validate-reset-token
   * Public endpoint - no authentication required
   */
  static validateResetToken = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        res.status(400).json({
          success: false,
          message: "Token is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const result =
        await UserController.passwordResetService.validateToken(token);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      UserController.handleError(error, res, "Validate reset token");
    }
  };

  /**
   * POST /auth/reset-password
   * Public endpoint - no authentication required
   */
  static resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== "string") {
        res.status(400).json({
          success: false,
          message: "Token is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      if (!newPassword || typeof newPassword !== "string") {
        res.status(400).json({
          success: false,
          message: "New password is required",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      // Password strength validation
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      await UserController.passwordResetService.resetPassword(
        token,
        newPassword
      );

      res.json({
        success: true,
        message: "Password has been reset successfully",
      });
    } catch (error) {
      UserController.handleError(error, res, "Reset password");
    }
  };

  /**
   * Handles errors consistently across all endpoints
   *
   * @param error - The error that occurred
   * @param res - Express response object
   * @param operation - Name of the operation for logging (e.g., "Registration", "Login")
   */
  private static handleError(
    error: any,
    res: Response,
    operation: string
  ): void {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }

    logger.error(`${operation} error`, { error });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}

// Export default for backward compatibility
export const registerUser = UserController.register;
