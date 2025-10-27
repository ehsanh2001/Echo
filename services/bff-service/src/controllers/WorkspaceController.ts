import { Response } from "express";
import axios from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Workspace Controller for BFF Service
 *
 * Forwards workspace management requests to the workspace-channel service.
 * Acts as a proxy/gateway for workspace operations.
 */
export class WorkspaceController {
  private static readonly WS_CH_SERVICE_URL =
    config.externalServices.workspaceChannelService;

  /**
   * POST /api/workspaces
   * Forward workspace creation to workspace-channel service
   */
  static createWorkspace = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      const response = await axios.post(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces`,
        req.body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Create workspace");
    }
  };

  /**
   * GET /api/workspaces/:id
   * Forward get workspace details to workspace-channel service
   */
  static getWorkspaceDetails = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;

      const response = await axios.get(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${id}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Get workspace details");
    }
  };

  /**
   * GET /api/workspaces/check-name/:name
   * Forward check name availability to workspace-channel service
   */
  static checkNameAvailability = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { name } = req.params;
      const authHeader = req.headers.authorization;

      const response = await axios.get(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/check-name/${name}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Check name availability");
    }
  };

  /**
   * POST /api/workspaces/:id/invites
   * Forward create workspace invite to workspace-channel service
   */
  static createInvite = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;

      const response = await axios.post(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${id}/invites`,
        req.body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Create workspace invite");
    }
  };

  /**
   * POST /api/workspaces/invites/accept
   * Forward accept workspace invite to workspace-channel service
   */
  static acceptInvite = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      const response = await axios.post(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/invites/accept`,
        req.body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Accept workspace invite");
    }
  };

  /**
   * Handle errors from workspace-channel service
   * Maps axios errors to appropriate HTTP responses
   */
  private static handleError(
    error: any,
    res: Response,
    operation: string
  ): void {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Forward the error response from workspace-channel service (1:1 mapping)
        logger.warn(`${operation} failed`, {
          status: error.response.status,
          data: error.response.data,
        });
        res.status(error.response.status).json(error.response.data);
      } else if (error.request) {
        // Workspace-channel service is unavailable
        logger.error(
          `${operation} failed: Workspace-channel service unavailable`,
          {
            error: error.message,
          }
        );
        res.status(503).json({
          success: false,
          message: "Workspace-channel service is currently unavailable",
          code: "SERVICE_UNAVAILABLE",
        });
      } else {
        // Request setup error
        logger.error(`${operation} failed: Request error`, {
          error: error.message,
        });
        res.status(500).json({
          success: false,
          message: "Failed to process workspace request",
          code: "REQUEST_ERROR",
        });
      }
    } else {
      // Non-axios error
      logger.error(`${operation} failed: Unexpected error`, { error });
      res.status(500).json({
        success: false,
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  }
}
