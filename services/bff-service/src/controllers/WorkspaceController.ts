import { Response } from "express";
import axios from "axios";
import { config } from "../config/env";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import { httpClient } from "../utils/httpClient";

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

      const response = await httpClient.post(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces`,
        req.body,
        {
          headers: {
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

      const response = await httpClient.get(
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

      const response = await httpClient.get(
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

      const response = await httpClient.post(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${id}/invites`,
        req.body,
        {
          headers: {
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

      const response = await httpClient.post(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/invites/accept`,
        req.body,
        {
          headers: {
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
   * GET /api/ws-ch/me/memberships
   * Forward get user memberships to workspace-channel service
   *
   * @param {boolean} includeChannels - Query parameter to include channel memberships in each workspace
   *
   * @returns {UserMembershipsResponse} Response containing:
   * - workspaces: WorkspaceMembershipResponse[] - Array of workspaces user belongs to
   *
   * Each WorkspaceMembershipResponse contains:
   * - id, name, displayName, description, ownerId, isArchived, maxMembers, isPublic, vanityUrl, settings, createdAt, updatedAt
   * - userRole: WorkspaceRole - User's role in this workspace (owner, admin, member)
   * - memberCount: number - Total active members in workspace
   * - channels?: ChannelMembershipResponse[] - Optional array of channels (if includeChannels=true)
   *
   * Each ChannelMembershipResponse contains:
   * - Channel fields: id, workspaceId, name, displayName, description, type, isArchived, isReadOnly, createdBy, memberCount, lastActivity, settings, createdAt, updatedAt
   * - Membership fields: role (owner, admin, member), joinedAt, isMuted, joinedBy
   *
   * @example
   * GET /api/workspaces/me/memberships?includeChannels=true
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "workspaces": [
   *       {
   *         "id": "ws_123",
   *         "name": "my-team",
   *         "displayName": "My Team",
   *         "userRole": "owner",
   *         "memberCount": 5,
   *         "channels": [
   *           {
   *             "id": "ch_456",
   *             "name": "general",
   *             "displayName": "General",
   *             "type": "public",
   *             "role": "admin",
   *             "joinedAt": "2024-01-01T00:00:00Z",
   *             "isMuted": false
   *           }
   *         ]
   *       }
   *     ]
   *   }
   * }
   */
  static getUserMemberships = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const { includeChannels } = req.query;

      const response = await httpClient.get(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/me/memberships`,
        {
          headers: {
            Authorization: authHeader,
          },
          params: {
            ...(includeChannels && { includeChannels }),
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Get user memberships");
    }
  };

  /**
   * GET /api/workspaces/:id/members
   * Forward get workspace members to workspace-channel service
   *
   * Returns all workspace members and channel members (for channels the user has access to)
   * with enriched user information.
   *
   * @returns {WorkspaceMembersResponse} Response containing:
   * - workspaceId: string - The workspace ID
   * - workspaceName: string - The workspace name
   * - workspaceMembers: WorkspaceMemberWithUserInfo[] - Array of workspace members with user details
   * - channels: ChannelWithMembers[] - Array of channels with their members (user has access to)
   */
  static getWorkspaceMembers = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.get(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${id}/members`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Get workspace members");
    }
  };

  /**
   * DELETE /api/workspaces/:id
   * Forward delete workspace to workspace-channel service
   *
   * Only workspace owners can delete a workspace.
   * Deletes the workspace and all associated data (channels, messages, members, etc.).
   * Triggers workspace.deleted event via RabbitMQ for real-time notifications.
   */
  static deleteWorkspace = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;

      const response = await httpClient.delete(
        `${WorkspaceController.WS_CH_SERVICE_URL}/api/ws-ch/workspaces/${id}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      WorkspaceController.handleError(error, res, "Delete workspace");
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
