import { injectable, inject } from "tsyringe";
import { Workspace, Invite, WorkspaceRole } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { IWorkspaceService } from "../interfaces/services/IWorkspaceService";
import { IWorkspaceRepository } from "../interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "../interfaces/repositories/IChannelRepository";
import { IInviteRepository } from "../interfaces/repositories/IInviteRepository";
import { IOutboxService } from "../interfaces/services/IOutboxService";
import { UserServiceClient } from "./userServiceClient";
import {
  CreateWorkspaceRequest,
  WorkspaceResponse,
  WorkspaceDetailsResponse,
  CreateWorkspaceData,
  AcceptInviteResponse,
  UserMembershipsResponse,
  WorkspaceMembershipResponse,
  ChannelMembershipResponse,
  WorkspaceMembersResponse,
  WorkspaceMemberWithUserInfo,
  ChannelWithMembers,
  EnrichedUserInfo,
} from "../types";
import {
  validateCreateWorkspaceRequest,
  throwIfValidationErrors,
} from "../utils/validation";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Service for workspace operations
 */
@injectable()
export class WorkspaceService implements IWorkspaceService {
  constructor(
    @inject("IWorkspaceRepository")
    private workspaceRepository: IWorkspaceRepository,
    @inject("IChannelRepository") private channelRepository: IChannelRepository,
    @inject("IInviteRepository") private inviteRepository: IInviteRepository,
    @inject("UserServiceClient") private userServiceClient: UserServiceClient,
    @inject("IOutboxService") private outboxService: IOutboxService,
    @inject(PrismaClient) private prisma: PrismaClient
  ) {}

  /**
   * Creates a new workspace with default channel and memberships.
   *
   * **Error Handling Strategy:**
   * This method follows a fail-fast pattern using exceptions. Each step (validation,
   * verification, creation) may throw WorkspaceChannelServiceError to indicate failure.
   *
   * @param userId - The ID of the user creating the workspace
   * @param request - The workspace creation request data
   * @throws {WorkspaceChannelServiceError} On validation, verification, or creation failure
   * @returns {Promise<WorkspaceResponse>} The created workspace details
   */
  async createWorkspace(
    userId: string,
    request: CreateWorkspaceRequest
  ): Promise<WorkspaceResponse> {
    try {
      logger.info(`📝 Creating workspace for user: ${userId}`);

      // Validate request data
      await this.validateWorkspaceCreationRequest(request);

      // Check user existence (with resilient fallback)
      await this.verifyUserCanCreateWorkspace(userId);

      // Prepare workspace data
      const workspaceData = this.prepareWorkspaceData(userId, request);

      // Create workspace with default channel and memberships
      const workspace = await this.workspaceRepository.create(
        workspaceData,
        userId
      );

      logger.info(
        `✅ Workspace created successfully: ${workspace.name} (${workspace.id})`
      );

      return this.mapWorkspaceToResponse(workspace);
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      logger.error("Error creating workspace:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to create workspace due to unexpected error"
      );
    }
  }

  /**
   * Checks if a workspace name is available (not already taken).
   *
   * @param name - The workspace name to check
   * @returns {Promise<boolean>} True if name is available, false if taken
   */
  async isNameAvailable(name: string): Promise<boolean> {
    try {
      const sanitizedName = this.sanitizeWorkspaceName(name);

      const existingWorkspace =
        await this.workspaceRepository.findByName(sanitizedName);
      return existingWorkspace === null;
    } catch (error) {
      logger.error("Error checking workspace name availability:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to check name availability"
      );
    }
  }

  /**
   * Validates workspace creation request data.
   *
   * **Exception-based validation pattern:**
   * This method uses exceptions (not return values) to indicate validation failures.
   * If validation passes, the method returns normally (void). If validation fails,
   * it throws a WorkspaceChannelServiceError with appropriate details.
   *
   *
   * @param request - The workspace creation request to validate
   * @throws {WorkspaceChannelServiceError} If validation fails (invalid data)
   * @returns {Promise<void>} Resolves if validation passes, rejects if validation fails
   */
  private async validateWorkspaceCreationRequest(
    request: CreateWorkspaceRequest
  ): Promise<void> {
    // Basic validation
    const validationErrors = validateCreateWorkspaceRequest(request);
    throwIfValidationErrors(
      validationErrors,
      "Invalid workspace creation request"
    );

    // Database unique constraints will handle name and displayName uniqueness
    // No need for pre-validation - let the database enforce constraints
  }

  /**
   * Verifies user exists and can create workspaces (with resilient fallback).
   *
   * **Exception-based verification pattern:**
   *
   * **Behavior:**
   * - User found → Returns normally (void)
   * - User service unavailable → Logs warning and returns normally (resilient fallback)
   * - User not found → Throws WorkspaceChannelServiceError
   * - Invalid userId format → Throws WorkspaceChannelServiceError
   *
   * @param userId - The ID of the user to verify
   * @throws {WorkspaceChannelServiceError} If user not found or validation fails
   * @returns {Promise<void>} Resolves if user is verified or service unavailable, rejects otherwise
   */
  private async verifyUserCanCreateWorkspace(userId: string): Promise<void> {
    try {
      // Verify user exists using user-service
      const userInfo = await this.userServiceClient.checkUserExistsById(userId);

      // If userInfo is null, it means user-service was down but we're proceeding
      if (userInfo !== null) {
        logger.info(`✅ User verified: ${userInfo.email}`);
      } else {
        logger.info(
          `⚠️ User verification skipped (service unavailable), proceeding with userId: ${userId}`
        );
      }
    } catch (error) {
      // UserServiceClient throws errors for user not found or validation issues
      throw error;
    }
  }

  /**
   * Generates a user-friendly display name from the workspace name.
   *
   * **Business Logic:**
   * If a display name is provided, use it (after trimming).
   * Otherwise, transform the workspace name by:
   * - Replacing dots, underscores, and hyphens with spaces
   * - Converting to title case
   *
   * @param name - The sanitized workspace name
   * @param providedDisplayName - Optional user-provided display name
   * @returns The display name to use
   * @example
   * generateDisplayName("my-workspace", undefined) // → "My Workspace"
   * generateDisplayName("my.workspace", "My Team") // → "My Team"
   */
  private generateDisplayName(
    name: string,
    providedDisplayName?: string
  ): string | null {
    if (providedDisplayName && providedDisplayName.trim().length > 0) {
      return providedDisplayName.trim();
    }

    // Convert name to a more readable display name
    // Replace dots, underscores, hyphens with spaces and title case
    return name
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  /**
   * Sanitizes workspace name by trimming and converting to lowercase.
   *
   *
   * @param name - The raw workspace name from user input
   * @returns Sanitized name (trimmed and lowercase)
   * @example
   * sanitizeWorkspaceName("  My-Workspace  ") // → "my-workspace"
   */
  private sanitizeWorkspaceName(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * Prepares workspace data from request.
   *
   * Sanitizes the workspace name and generates/uses the display name.
   *
   * @param userId - The ID of the user creating the workspace
   * @param request - The workspace creation request
   * @returns Prepared workspace data ready for repository
   */
  private prepareWorkspaceData(
    userId: string,
    request: CreateWorkspaceRequest
  ): CreateWorkspaceData {
    const sanitizedName = this.sanitizeWorkspaceName(request.name);
    const displayName = this.generateDisplayName(
      sanitizedName,
      request.displayName
    );

    // Prepare description - use null if not provided (matches Prisma schema)
    const trimmedDescription = request.description?.trim();
    const description = trimmedDescription || null;

    return {
      name: sanitizedName,
      displayName,
      description,
      ownerId: userId,
      settings: {},
    };
  }

  /**
   * Maps database workspace to response format
   * Properly handles nullable fields from Prisma schema
   */
  private mapWorkspaceToResponse(workspace: Workspace): WorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      displayName: workspace.displayName,
      description: workspace.description,
      ownerId: workspace.ownerId,
      isArchived: workspace.isArchived,
      maxMembers: workspace.maxMembers,
      isPublic: workspace.isPublic,
      vanityUrl: workspace.vanityUrl,
      settings: workspace.settings,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  /**
   * Get workspace details for a member
   *
   * User Story: View Workspace Info (1.4)
   * - Validates workspace exists
   * - Validates user is an active member
   * - Returns workspace details with user's role and member count
   *
   * @param userId - The ID of the user requesting workspace details
   * @param workspaceId - The ID of the workspace to retrieve
   * @throws {WorkspaceChannelServiceError} 404 if workspace not found, 403 if not a member or inactive
   * @returns {Promise<WorkspaceDetailsResponse>} Workspace details with user's role and member count
   */
  async getWorkspaceDetails(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceDetailsResponse> {
    // 1. Find workspace
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw WorkspaceChannelServiceError.notFound("Workspace", workspaceId);
    }

    // 2. Check user membership
    const membership = await this.workspaceRepository.getMembership(
      userId,
      workspaceId
    );

    if (!membership) {
      throw WorkspaceChannelServiceError.forbidden(
        "You are not a member of this workspace"
      );
    }

    // 3. Verify membership is active
    if (!membership.isActive) {
      throw WorkspaceChannelServiceError.forbidden(
        "Your membership in this workspace is inactive"
      );
    }

    // 4. Count active members
    const memberCount =
      await this.workspaceRepository.countActiveMembers(workspaceId);

    // 5. Build response with user's role
    const baseResponse = this.mapWorkspaceToResponse(workspace);

    return {
      ...baseResponse,
      userRole: membership.role,
      memberCount,
    };
  }

  /**
   * Accept a workspace invite
   * Atomically adds user to workspace and all public channels
   */
  async acceptInvite(
    token: string,
    userId: string,
    userEmail: string
  ): Promise<AcceptInviteResponse> {
    try {
      logger.info(`Processing invite acceptance for user: ${userId}`);

      //  Find invite by token
      const invite: Invite | null =
        await this.inviteRepository.findByToken(token);
      if (!invite) {
        throw WorkspaceChannelServiceError.notFound("Invite", token);
      }

      //  Validate that the invite is for the current user
      if (!invite.email) {
        throw WorkspaceChannelServiceError.badRequest(
          "Invalid invite: email is missing"
        );
      }

      // if invite is already accepted
      if (invite.acceptedAt) {
        throw WorkspaceChannelServiceError.conflict(
          "This invite has already been accepted"
        );
      }

      if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw WorkspaceChannelServiceError.forbidden(
          "This invite was sent to a different email address"
        );
      }

      //  Validate invite and workspace
      const workspace = await this.validateInviteAndWorkspace(invite);

      // Execute all operations in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Add user to workspace and mark invite as accepted
        await this.addUserToWorkspaceAndAcceptInvite(
          workspace.id,
          userId,
          invite,
          tx
        );

        // Add user to all public channels
        const publicChannels = await this.addUserToPublicChannels(
          workspace.id,
          userId,
          invite.inviterId || userId,
          tx
        );

        return { workspace, publicChannels };
      });

      logger.info(
        `✅ Invite accepted: User ${userId} joined workspace ${workspace.name} and ${result.publicChannels.length} public channels`
      );

      // Publish member events (outside transaction for better isolation)
      await this.publishMemberJoinedEvents(
        result.workspace,
        result.publicChannels,
        userId,
        invite.role,
        invite.id
      );

      // Build response
      return {
        message: "Invite accepted successfully",
        workspace: {
          id: workspace.id,
          name: workspace.name,
          displayName: workspace.displayName,
        },
        channels: result.publicChannels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          displayName: channel.displayName,
        })),
      };
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      logger.error("Error accepting invite:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to accept invite due to unexpected error"
      );
    }
  }

  /**
   * Validates invite and workspace
   * @private
   */
  private async validateInviteAndWorkspace(invite: any): Promise<Workspace> {
    // 2. Validate invite type
    if (invite.type !== "workspace") {
      throw WorkspaceChannelServiceError.badRequest(
        "Invalid invite type for workspace"
      );
    }

    // 3. Check if expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw WorkspaceChannelServiceError.expired("Invite");
    }

    // 4. Find workspace
    const workspace = await this.workspaceRepository.findById(
      invite.workspaceId!
    );
    if (!workspace) {
      throw WorkspaceChannelServiceError.notFound(
        "Workspace",
        invite.workspaceId || "unknown"
      );
    }

    // 5. Check workspace is not archived
    if (workspace.isArchived) {
      throw WorkspaceChannelServiceError.forbidden(
        "Cannot accept invite to archived workspace"
      );
    }

    return workspace;
  }

  /**
   * Adds user to workspace and marks invite as accepted (steps 6.1-6.2)
   * @private
   */
  private async addUserToWorkspaceAndAcceptInvite(
    workspaceId: string,
    userId: string,
    invite: any,
    tx: any
  ): Promise<void> {
    // 6.1 Add user to workspace (or reactivate)
    await this.workspaceRepository.addOrReactivateMember(
      workspaceId,
      userId,
      invite.role || "member",
      invite.inviterId || userId, // Use inviter ID or fallback to user themselves
      tx
    );

    // 6.2 Mark invite as accepted
    await this.inviteRepository.markAsAccepted(
      invite.id,
      userId,
      new Date(),
      tx
    );
  }

  /**
   * Adds user to all public channels in workspace (steps 6.3-6.4)
   * @private
   */
  private async addUserToPublicChannels(
    workspaceId: string,
    userId: string,
    inviterId: string,
    tx: any
  ): Promise<any[]> {
    // 6.3 Get all public non-archived channels
    const publicChannels =
      await this.channelRepository.findPublicChannelsByWorkspace(
        workspaceId,
        tx
      );

    // 6.4 Add user to all public channels
    for (const channel of publicChannels) {
      await this.channelRepository.addOrReactivateMember(
        channel.id,
        userId,
        inviterId, // Use inviter or fallback to user themselves
        "member",
        tx
      );
    }

    return publicChannels;
  }

  /**
   * Publishes member joined events for workspace and channels
   * @private
   */
  private async publishMemberJoinedEvents(
    workspace: Workspace,
    publicChannels: any[],
    userId: string,
    role: string,
    inviteId: string
  ): Promise<void> {
    try {
      // Fetch user details for the event payload
      const userDetails = await this.fetchUserDetailsForEvent(userId);

      // Publish workspace.member.joined event
      await this.outboxService.createWorkspaceMemberJoinedEvent({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        userId,
        role: role as "admin" | "member",
        user: userDetails,
        inviteId,
      });

      logger.info(
        `📤 Published workspace.member.joined event for user ${userId} in workspace ${workspace.name}`
      );

      // Publish channel.member.joined events for each public channel
      for (const channel of publicChannels) {
        await this.outboxService.createChannelMemberJoinedEvent({
          channelId: channel.id,
          channelName: channel.name,
          workspaceId: workspace.id,
          userId,
          role: "member",
          user: userDetails,
        });
      }

      logger.info(
        `📤 Published ${publicChannels.length} channel.member.joined events for user ${userId}`
      );
    } catch (error) {
      // Log error but don't fail the invite acceptance
      // Events can be retried via outbox pattern if needed
      logger.error("Error publishing member joined events:", error);
    }
  }

  /**
   * Fetches user details from user service for event payloads
   * @private
   */
  private async fetchUserDetailsForEvent(
    userId: string
  ): Promise<EnrichedUserInfo> {
    try {
      const usersMap = await this.userServiceClient.getUsersByIds([userId]);
      const user = usersMap.get(userId);
      if (user) {
        return user;
      }
    } catch (error) {
      logger.warn(
        `Failed to fetch user details for event, using placeholder: ${error}`
      );
    }

    // Return placeholder if user fetch fails
    return {
      id: userId,
      username: "unknown",
      displayName: "Unknown User",
      email: "",
      avatarUrl: null,
      lastSeen: null,
    };
  }

  /**
   * Gets all workspaces and optionally channels that a user is a member of.
   * Only includes active memberships, non-archived channels, and excludes direct channels.
   * Results are sorted alphabetically.
   *
   * @param userId - The ID of the user to get memberships for
   * @param includeChannels - Whether to include channels in each workspace
   * @returns {Promise<UserMembershipsResponse>} User's workspace and channel memberships
   */
  async getUserMemberships(
    userId: string,
    includeChannels: boolean = false
  ): Promise<UserMembershipsResponse> {
    try {
      logger.info(
        `📝 Getting memberships for user: ${userId}, includeChannels: ${includeChannels}`
      );

      // Get all workspaces the user is a member of
      const workspacesData =
        await this.workspaceRepository.findWorkspacesByUserId(userId);

      // Map to workspace membership responses
      const workspaces: WorkspaceMembershipResponse[] = await Promise.all(
        workspacesData.map(async ({ workspace, memberCount, userRole }) => {
          const workspaceResponse: WorkspaceMembershipResponse = {
            ...this.mapWorkspaceToResponse(workspace),
            userRole: userRole as any,
            memberCount,
          };

          // If includeChannels is true, fetch channel memberships
          if (includeChannels) {
            const channelMemberships =
              await this.channelRepository.getChannelMembershipsByUserId(
                userId,
                workspace.id
              );

            workspaceResponse.channels = channelMemberships.map(
              ({ channel, membership }) => ({
                // Spread all channel fields
                ...channel,
                // Override type casting for enum compatibility
                type: channel.type as any,
                // Spread membership fields (excluding id and channelId to avoid conflicts)
                role: membership.role as any,
                joinedAt: membership.joinedAt,
                isMuted: membership.isMuted,
                joinedBy: membership.joinedBy,
              })
            );
          }

          return workspaceResponse;
        })
      );

      logger.info(`✅ Found ${workspaces.length} workspace memberships`);

      return {
        workspaces,
      };
    } catch (error) {
      logger.error("Error getting user memberships:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to get user memberships"
      );
    }
  }

  /**
   * Get workspace members and channel members for channels user belongs to
   * Returns enriched user data with caching
   *
   * @param userId - The ID of the user requesting the data
   * @param workspaceId - The workspace ID
   * @returns WorkspaceMembersResponse with workspace members and channel members
   * @throws WorkspaceChannelServiceError if user is not a member or workspace not found
   */
  async getWorkspaceMembers(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceMembersResponse> {
    try {
      logger.info(
        `📋 Getting workspace members for workspace ${workspaceId} by user ${userId}`
      );

      // Verify membership and get workspace
      const { workspace, isAdminOrOwner } =
        await this.verifyWorkspaceMembershipAndAccess(userId, workspaceId);

      // Get workspace members
      const workspaceMembers = await this.workspaceRepository.getMembers(
        workspaceId,
        isAdminOrOwner
      );

      // Get channel data with admin access information
      const { channelsWithMembers, channelIdsWithAdminAccess } =
        await this.getChannelsWithAdminAccess(userId, workspaceId);

      // Collect all unique user IDs and fetch their details
      const userDetailsMap = await this.fetchUserDetails(
        workspaceMembers,
        channelsWithMembers
      );

      // Enrich data with user information
      const enrichedWorkspaceMembers = this.enrichWorkspaceMembersWithUserData(
        workspaceMembers,
        userDetailsMap
      );
      const enrichedChannels = this.enrichChannelsWithUserData(
        channelsWithMembers,
        userDetailsMap
      );

      logger.info(
        `✅ Retrieved ${enrichedWorkspaceMembers.length} workspace members and ${enrichedChannels.length} channels with members`
      );

      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceMembers: enrichedWorkspaceMembers,
        channels: enrichedChannels,
      };
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      logger.error("Error getting workspace members:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to get workspace members"
      );
    }
  }

  /**
   * Verifies user workspace membership and determines admin access level
   * @private
   */
  private async verifyWorkspaceMembershipAndAccess(
    userId: string,
    workspaceId: string
  ): Promise<{ workspace: Workspace; isAdminOrOwner: boolean }> {
    // Verify user is a workspace member
    const membership = await this.workspaceRepository.getMembership(
      userId,
      workspaceId
    );

    if (!membership || !membership.isActive) {
      throw WorkspaceChannelServiceError.forbidden(
        "You are not a member of this workspace"
      );
    }

    // Get workspace info
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw WorkspaceChannelServiceError.notFound(
        "Workspace not found",
        workspaceId
      );
    }

    // Check if user is admin/owner (can see inactive members)
    const isAdminOrOwner =
      membership.role === "owner" || membership.role === "admin";

    return { workspace, isAdminOrOwner };
  }

  /**
   * Gets channel memberships and determines which channels user has admin access to
   * @private
   */
  private async getChannelsWithAdminAccess(
    userId: string,
    workspaceId: string
  ): Promise<{
    channelsWithMembers: any[];
    channelIdsWithAdminAccess: string[];
  }> {
    // Get user's channel memberships
    const userChannelMemberships =
      await this.channelRepository.getChannelMembershipsByUserId(
        userId,
        workspaceId
      );

    // Extract channel IDs where user has admin/owner role
    const channelIdsWithAdminAccess = userChannelMemberships
      .filter(
        (cm) => cm.membership.role === "owner" || cm.membership.role === "admin"
      )
      .map((cm) => cm.channel.id);

    // Get channel members for channels user belongs to
    const channelsWithMembers =
      await this.channelRepository.getChannelMembersByWorkspace(
        workspaceId,
        userId,
        channelIdsWithAdminAccess
      );

    return { channelsWithMembers, channelIdsWithAdminAccess };
  }

  /**
   * Collects unique user IDs and fetches their details with caching
   * @private
   */
  private async fetchUserDetails(
    workspaceMembers: any[],
    channelsWithMembers: any[]
  ): Promise<Map<string, EnrichedUserInfo>> {
    // Collect all unique user IDs
    const userIds = new Set<string>();
    workspaceMembers.forEach((member) => userIds.add(member.userId));
    channelsWithMembers.forEach((channel) =>
      channel.members.forEach((member: any) => userIds.add(member.userId))
    );

    // Fetch user details with caching
    return await this.userServiceClient.getUsersByIds(Array.from(userIds));
  }

  /**
   * Enriches workspace members with user data
   * @private
   */
  private enrichWorkspaceMembersWithUserData(
    workspaceMembers: any[],
    userDetailsMap: Map<string, EnrichedUserInfo>
  ): WorkspaceMemberWithUserInfo[] {
    return workspaceMembers
      .map((member) => {
        const userInfo = userDetailsMap.get(member.userId);
        if (!userInfo) {
          logger.warn(
            `User data not found for workspace member: ${member.userId}`
          );
          return null;
        }
        return {
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: userInfo,
        };
      })
      .filter(
        (member): member is WorkspaceMemberWithUserInfo => member !== null
      );
  }

  /**
   * Enriches channel members with user data
   * @private
   */
  private enrichChannelsWithUserData(
    channelsWithMembers: any[],
    userDetailsMap: Map<string, EnrichedUserInfo>
  ): ChannelWithMembers[] {
    return channelsWithMembers.map((channel) => {
      const enrichedMembers = channel.members
        .map((member: any) => {
          const userInfo = userDetailsMap.get(member.userId);
          if (!userInfo) {
            logger.warn(
              `User data not found for channel member: ${member.userId}`
            );
            return null;
          }
          return {
            userId: member.userId,
            channelId: channel.channelId,
            role: member.role,
            joinedAt: member.joinedAt,
            user: userInfo,
          };
        })
        .filter((member: any) => member !== null);

      return {
        id: channel.channelId,
        name: channel.channelName,
        displayName: channel.channelDisplayName,
        type: channel.channelType as any,
        members: enrichedMembers as any[],
      };
    });
  }

  /**
   * Deletes a workspace and all related data.
   * Only workspace owners can delete a workspace.
   *
   * Follows the Transactional Outbox pattern - both the domain change (deletion)
   * and the event creation succeed or fail together atomically.
   */
  async deleteWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<{ workspaceId: string }> {
    try {
      // 1. Find the workspace
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw WorkspaceChannelServiceError.notFound("Workspace", workspaceId);
      }

      // 2. Check permissions: user must be workspace owner
      const workspaceMember = await this.workspaceRepository.getMembership(
        userId,
        workspaceId
      );

      if (!workspaceMember || workspaceMember.role !== WorkspaceRole.owner) {
        throw WorkspaceChannelServiceError.forbidden(
          "Only workspace owners can delete a workspace"
        );
      }

      // 3. Get all channel IDs before deletion (for Socket.IO room cleanup)
      const channelIds =
        await this.workspaceRepository.getChannelIds(workspaceId);

      // 4. Delete the workspace and create outbox event in a single transaction
      await this.prisma.$transaction(async (tx) => {
        // Create outbox event FIRST (before deletion)
        // Note: workspaceId is set to null in the event to avoid FK constraint issues
        await this.outboxService.createWorkspaceDeletedEvent(
          {
            workspaceId,
            workspaceName: workspace.displayName || workspace.name,
            deletedBy: userId,
            channelIds,
          },
          undefined, // correlationId
          undefined, // causationId
          tx // transaction context
        );

        // Then delete the workspace and all related data
        await this.workspaceRepository.deleteWorkspace(workspaceId, tx);
      });

      logger.info("Workspace deleted successfully", {
        workspaceId,
        deletedBy: userId,
        workspaceName: workspace.name,
        channelCount: channelIds.length,
      });

      return { workspaceId };
    } catch (error) {
      if (error instanceof WorkspaceChannelServiceError) {
        throw error;
      }
      logger.error("Error deleting workspace:", error);
      throw WorkspaceChannelServiceError.database(
        "Failed to delete workspace due to unexpected error"
      );
    }
  }
}
