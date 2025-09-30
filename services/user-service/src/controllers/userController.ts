import { Request, Response } from "express";
import { container } from "../container";
import { IUserService } from "../interfaces/services/IUserService";
import { IAuthService } from "../interfaces/services/IAuthService";
import { RegisterRequest, LoginRequest } from "../types/auth.types";
import { UserServiceError } from "../types/error.types";
import { AuthenticatedRequest } from "../middleware/jwtAuth";

export class UserController {
  private static userService = container.resolve<IUserService>("IUserService");
  private static authService = container.resolve<IAuthService>("IAuthService");
  /**
   * POST /auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const userData: RegisterRequest = req.body;
      const result = await this.userService.registerUser(userData);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      this.handleError(error, res, "Registration");
    }
  }

  /**
   * POST /auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;
      const result = await this.authService.loginUser(loginData);

      res.json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      this.handleError(error, res, "Login");
    }
  }

  /**
   * POST /auth/refresh
   * Requires jwtRefreshAuth middleware (refresh token in Authorization header)
   */
  static async refresh(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
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
      const result = await this.authService.refreshToken(refreshToken);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: result,
      });
    } catch (error) {
      this.handleError(error, res, "Token refresh");
    }
  }

  /**
   * POST /auth/logout
   * Requires JWT authentication middleware
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      await this.authService.logoutUser(req.user.userId);

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      this.handleError(error, res, "Logout");
    }
  }

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

    console.error(`${operation} error:`, error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}

// Export default for backward compatibility
export const registerUser = UserController.register;
