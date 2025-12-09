import { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import { httpClient } from "../utils/httpClient";

/**
 * Authentication Controller for BFF Service
 *
 * Forwards authentication requests to the user service.
 * Acts as a proxy/gateway for auth operations.
 */
export class AuthController {
  private static readonly USER_SERVICE_URL =
    config.externalServices.userService;

  /**
   * POST /api/auth/register
   * Forward user registration to user service
   *
   * @param req.body.email - User email
   * @param req.body.username - Desired username
   * @param req.body.password - User password
   * @param req.body.displayName - Optional display name
   * @returns {Promise<Object>} Registration response
   * {
   *   success: boolean;
   *   message: string;
   *   data?: {
   *     id: string;
   *     email: string;
   *     username: string;
   *     displayName: string;
   *     bio: string | null;
   *     avatarUrl: string | null;
   *     createdAt: string;
   *     lastSeen: string | null;
   *     roles: string[];
   *   };
   * }
   */
  static register = async (req: Request, res: Response): Promise<void> => {
    try {
      const response = await httpClient.post(
        `${AuthController.USER_SERVICE_URL}/api/users/auth/register`,
        req.body
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      AuthController.handleError(error, res, "Register");
    }
  };

  /**
   * POST /api/auth/login
   * Forward user login to user service
   *
   * @param req.body.identifier - Email or username
   * @param req.body.password - User password
   * @returns {Promise<Object>} Login response
   * {
   *   success: boolean;
   *   message: string;
   *   data?: {
   *     access_token: string;
   *     refresh_token: string;
   *     expires_in: number;  // Expiration time in seconds
   *     user: {
   *       id: string;
   *       email: string;
   *       username: string;
   *       displayName: string;
   *       bio: string | null;
   *       avatarUrl: string | null;
   *       createdAt: string;
   *       lastSeen: string | null;
   *       roles: string[];
   *     };
   *   };
   * }
   */
  static login = async (req: Request, res: Response): Promise<void> => {
    try {
      const response = await httpClient.post(
        `${AuthController.USER_SERVICE_URL}/api/users/auth/login`,
        req.body
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      AuthController.handleError(error, res, "Login");
    }
  };

  /**
   * POST /api/auth/refresh
   * Forward refresh request to user service
   * Requires jwtAuth middleware (refresh token in Authorization header)
   *
   * @returns Response format from user-service:
   * {
   *   success: boolean;
   *   message: string;
   *   data: {
   *     access_token: string;
   *     refresh_token: string;
   *     expires_in: number;
   *   };
   * }
   */
  static refresh = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          message: "Authorization header is required",
          code: "MISSING_AUTH_HEADER",
        });
        return;
      }

      const response = await httpClient.post(
        `${AuthController.USER_SERVICE_URL}/api/users/auth/refresh`,
        {}, // Empty body
        {
          headers: {
            Authorization: authHeader, // Forward the refresh token
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      AuthController.handleError(error, res, "Refresh token");
    }
  };

  /**
   * POST /api/auth/logout
   * Forward logout request to user service
   * Requires jwtAuth middleware (access token in Authorization header)
   *
   * @returns Response format from user-service:
   * {
   *   success: boolean;
   *   message: string;
   * }
   */
  static logout = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          message: "Authorization header is required",
          code: "MISSING_AUTH_HEADER",
        });
        return;
      }

      const response = await httpClient.post(
        `${AuthController.USER_SERVICE_URL}/api/users/auth/logout`,
        {}, // Empty body
        {
          headers: {
            Authorization: authHeader, // Forward the access token
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      AuthController.handleError(error, res, "Logout");
    }
  };

  /**
   * Handle errors from user service
   * Maps user service errors to appropriate HTTP responses
   */
  private static handleError(
    error: any,
    res: Response,
    operation: string
  ): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Forward error response from user service
      if (axiosError.response) {
        logger.warn(`${operation} failed - User service error`, {
          status: axiosError.response.status,
          data: axiosError.response.data,
        });

        res.status(axiosError.response.status).json(axiosError.response.data);
        return;
      }

      // Network error (user service unreachable)
      if (axiosError.request) {
        logger.error(`${operation} failed - User service unreachable`, {
          error: axiosError.message,
        });

        res.status(503).json({
          success: false,
          message: "User service is currently unavailable",
          code: "SERVICE_UNAVAILABLE",
        });
        return;
      }
    }

    // Unknown error
    logger.error(`${operation} failed - Unknown error`, { error });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}
