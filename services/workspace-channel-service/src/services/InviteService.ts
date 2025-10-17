import { inject, injectable } from "tsyringe";
import { randomBytes } from "crypto";
import { WorkspaceRole } from "@prisma/client";
import { IInviteService } from "../interfaces/services/IInviteService";
import { IInviteRepository } from "../interfaces/repositories/IInviteRepository";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { IOutboxService } from "../interfaces/services/IOutboxService";
import {
  CreateWorkspaceInviteRequest,
  WorkspaceInviteResponse,
  CreateWorkspaceInviteData,
  CreateInviteEventData,
} from "../types";
import { config } from "../config/env";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * InviteService - Handles business logic for workspace invitations
 *
 * Responsibilities:
 * - Validate invite creation requests
 * - Generate secure invite tokens
 * - Create invite records in database
 * - Publish invite.created events via outbox
 * - Build invite URLs for email delivery
 * Note: Actual email sending is handled by a separate notification microservice
 */
@injectable()
export class InviteService implements IInviteService {
  constructor(
    @inject("IInviteRepository")
    private inviteRepository: IInviteRepository,
    @inject("IWorkspaceRepository")
    private workspaceRepository: IWorkspaceRepository,
    @inject("IOutboxService")
    private outboxService: IOutboxService
  ) {}

  /**
   * Create a workspace invite
   *
   * Business Logic:
   * 1. Validate workspace exists and is not archived
   * 2. Validate email format
   * 3. Validate role is allowed
   * 4. Validate expiration days within bounds
   * 5. Validate custom message length
   * 6. Generate secure invite token
   * 7. Calculate expiration date
   * 8. Create invite in database
   * 9. Publish invite.created event to outbox
   * 10. Build and return invite response
   *
   * @param workspaceId - The workspace ID to invite to
   * @param inviterId - The user ID of the person creating the invite
   * @param inviteData - The invite creation request data
   * @returns Promise resolving to the created invite response
   * @throws WorkspaceChannelServiceError if validation fails or creation fails
   */
  async createWorkspaceInvite(
    workspaceId: string,
    inviterId: string,
    inviteData: CreateWorkspaceInviteRequest
  ): Promise<WorkspaceInviteResponse> {
    // 1. Validate workspace exists and is not archived
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw WorkspaceChannelServiceError.notFound(
        `Workspace not found: ${workspaceId}`
      );
    }

    if (workspace.isArchived) {
      throw WorkspaceChannelServiceError.forbidden(
        "Cannot create invites for archived workspaces"
      );
    }

    // 2. Validate email format
    this.validateEmail(inviteData.email);

    // 3. Validate and set default role
    const role = this.validateAndSetRole(inviteData.role);

    // 4. Validate and calculate expiration
    const expiresAt = this.calculateExpiration(inviteData.expiresInDays);

    // 5. Validate custom message if provided
    if (inviteData.customMessage) {
      this.validateCustomMessage(inviteData.customMessage);
    }

    // 6. Generate secure invite token
    const inviteToken = this.generateInviteToken();

    // 7. Create invite data for repository
    const createInviteData: CreateWorkspaceInviteData = {
      workspaceId,
      inviterId,
      email: inviteData.email.toLowerCase().trim(), // Normalize email
      inviteToken,
      type: "workspace",
      role,
      expiresAt,
      metadata: inviteData.customMessage
        ? { customMessage: inviteData.customMessage }
        : {},
    };

    // 8. Create invite in database
    const invite = await this.inviteRepository.create(createInviteData);

    // 9. Publish invite.created event via outbox
    const inviteUrl = this.buildInviteUrl(inviteToken);
    await this.publishInviteCreatedEvent(invite, workspace, inviteUrl);

    // 10. Return invite response
    // Type assertions are safe here because we just created the invite with these values
    return {
      inviteId: invite.id,
      email: invite.email!,
      workspaceId: invite.workspaceId!,
      inviteUrl,
      role: invite.role,
      invitedBy: invite.inviterId!,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Validate email format
   * @param email - Email address to validate
   * @throws WorkspaceChannelServiceError if email is invalid
   */
  private validateEmail(email: string): void {
    if (!email || typeof email !== "string") {
      throw WorkspaceChannelServiceError.validation("Email is required", {
        field: "email",
        message: "Email is required",
        value: email,
      });
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      throw WorkspaceChannelServiceError.validation("Email cannot be empty", {
        field: "email",
        message: "Email cannot be empty",
        value: email,
      });
    }

    // Basic email format validation (RFC 5322 simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw WorkspaceChannelServiceError.validation("Invalid email format", {
        field: "email",
        message: "Invalid email format",
        value: trimmedEmail,
      });
    }
  }

  /**
   * Validate role and set default if not provided
   * @param role - Optional role from request
   * @returns Validated role
   * @throws WorkspaceChannelServiceError if role is invalid
   */
  private validateAndSetRole(role?: WorkspaceRole): WorkspaceRole {
    // Use default role if not provided
    if (!role) {
      return config.invites.defaultRole;
    }

    // Validate role is one of the allowed values
    const allowedRoles = Object.values(WorkspaceRole);
    if (!allowedRoles.includes(role)) {
      throw WorkspaceChannelServiceError.validation(
        `Invalid role: ${role}. Must be one of: ${allowedRoles.join(", ")}`,
        {
          field: "role",
          message: `Must be one of: ${allowedRoles.join(", ")}`,
          value: role,
        }
      );
    }

    return role;
  }

  /**
   * Calculate expiration date based on days from now
   * @param expiresInDays - Optional number of days until expiration
   * @returns Expiration date or null if no expiration
   * @throws WorkspaceChannelServiceError if days is out of bounds
   */
  private calculateExpiration(expiresInDays?: number): Date | null {
    // Use default if not provided
    const days =
      expiresInDays !== undefined
        ? expiresInDays
        : config.invites.defaultExpirationDays;

    // Validate expiration days within bounds
    if (days < config.invites.minExpirationDays) {
      throw WorkspaceChannelServiceError.validation(
        `Expiration days must be at least ${config.invites.minExpirationDays}`,
        {
          field: "expiresInDays",
          message: `Must be at least ${config.invites.minExpirationDays}`,
          value: days,
        }
      );
    }

    if (days > config.invites.maxExpirationDays) {
      throw WorkspaceChannelServiceError.validation(
        `Expiration days cannot exceed ${config.invites.maxExpirationDays}`,
        {
          field: "expiresInDays",
          message: `Cannot exceed ${config.invites.maxExpirationDays}`,
          value: days,
        }
      );
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  /**
   * Validate custom message length
   * @param message - Custom message to validate
   * @throws WorkspaceChannelServiceError if message is too long
   */
  private validateCustomMessage(message: string): void {
    if (message.length > config.invites.maxCustomMessageLength) {
      throw WorkspaceChannelServiceError.validation(
        `Custom message cannot exceed ${config.invites.maxCustomMessageLength} characters`,
        {
          field: "customMessage",
          message: `Cannot exceed ${config.invites.maxCustomMessageLength} characters`,
          value: message.length,
        }
      );
    }
  }

  /**
   * Generate a cryptographically secure invite token
   * @returns Hex-encoded random token
   */
  private generateInviteToken(): string {
    // tokenLength is in characters(hex digits), randomBytes needs half that in bytes
    return randomBytes(config.invites.tokenLength / 2).toString("hex");
  }

  /**
   * Build the invite URL for email delivery
   * @param inviteToken - The invite token
   * @returns Full invite URL
   */
  private buildInviteUrl(inviteToken: string): string {
    const baseUrl = config.frontend.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    return `${baseUrl}/invite/${inviteToken}`;
  }

  /**
   * Publish invite.created event to outbox
   * @param invite - The created invite
   * @param workspace - The workspace data
   * @param inviteUrl - The invite URL
   */
  private async publishInviteCreatedEvent(
    invite: any,
    workspace: any,
    inviteUrl: string
  ): Promise<void> {
    // Build event data
    const eventData: CreateInviteEventData = {
      inviteId: invite.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceDisplayName: workspace.displayName,
      email: invite.email!,
      role: invite.role,
      inviterUserId: invite.inviterId!,
      inviteToken: invite.inviteToken!,
      inviteUrl,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      customMessage: invite.metadata?.customMessage,
    };

    // Create outbox event
    await this.outboxService.createInviteEvent(eventData);
  }
}
