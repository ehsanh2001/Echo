import { injectable } from "tsyringe";
import { PrismaClient, Invite } from "@prisma/client";
import { IInviteRepository } from "../interfaces/repositories/IInviteRepository";
import { CreateWorkspaceInviteData } from "../types";
import { WorkspaceChannelServiceError } from "../utils/errors";

/**
 * Repository implementation for invite operations using Prisma
 */
@injectable()
export class InviteRepository implements IInviteRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new workspace invite
   * @param data - Invite creation data
   * @returns Promise resolving to the created invite
   */
  async create(data: CreateWorkspaceInviteData): Promise<Invite> {
    try {
      return await this.prisma.invite.create({
        data: {
          workspaceId: data.workspaceId,
          inviterId: data.inviterId,
          email: data.email,
          inviteToken: data.inviteToken,
          type: data.type,
          role: data.role,
          expiresAt: data.expiresAt || null,
          metadata: data.metadata || {},
        },
      });
    } catch (error: any) {
      this.handleInviteError(error, data);
    }
  }

  /**
   * Find a pending workspace invite by email and workspace
   * Used to check for duplicate invites and invalidate old ones
   * @param email - The email address
   * @param workspaceId - The workspace ID
   * @returns Promise resolving to the invite or null if not found
   */
  async findPendingByEmailAndWorkspace(
    email: string,
    workspaceId: string
  ): Promise<Invite | null> {
    try {
      return await this.prisma.invite.findFirst({
        where: {
          email,
          workspaceId,
          type: "workspace",
          acceptedAt: null, // Not accepted
          OR: [
            { expiresAt: null }, // No expiration
            { expiresAt: { gt: new Date() } }, // Not expired
          ],
        },
        orderBy: {
          createdAt: "desc", // Most recent first
        },
      });
    } catch (error: any) {
      console.error("Error finding pending invite:", error);
      this.handleInviteError(error);
    }
  }

  /**
   * Find all pending invites
   * Used by outbox service to send/resend notifications for all pending invites
   * @returns Promise resolving to array of all pending invites
   */
  async findAllPending(): Promise<Invite[]> {
    try {
      return await this.prisma.invite.findMany({
        where: {
          acceptedAt: null, // Not accepted
          OR: [
            { expiresAt: null }, // No expiration
            { expiresAt: { gt: new Date() } }, // Not expired
          ],
        },
        orderBy: {
          createdAt: "asc", // Oldest first for processing
        },
      });
    } catch (error: any) {
      console.error("Error finding all pending invites:", error);
      this.handleInviteError(error);
    }
  }

  /**
   * Invalidate an invite (mark as accepted or expired)
   * @param inviteId - The invite ID to invalidate
   * @param acceptedBy - Optional user ID who accepted the invite
   * @returns Promise resolving when invalidation is complete
   */
  async invalidateInvite(inviteId: string, acceptedBy?: string): Promise<void> {
    try {
      const updateData: any = {
        acceptedAt: new Date(),
      };

      if (acceptedBy) {
        updateData.acceptedBy = acceptedBy;
      }

      await this.prisma.invite.update({
        where: { id: inviteId },
        data: updateData,
      });
    } catch (error: any) {
      this.handleInviteError(error, undefined, inviteId);
    }
  }

  /**
   * Delete expired invites (cleanup operation)
   * @param olderThan - Delete invites expired before this date
   * @returns Promise resolving to number of deleted invites
   */
  async deleteUnacceptedExpired(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.invite.deleteMany({
        where: {
          expiresAt: {
            lt: olderThan,
          },
          acceptedAt: null, // Only delete unaccepted invites
        },
      });

      return result.count;
    } catch (error: any) {
      console.error("Error deleting expired invites:", error);
      this.handleInviteError(error);
    }
  }

  /**
   * Handle invite-specific errors and convert them to appropriate service errors
   * @param error - The Prisma error
   * @param inviteData - The invite data that caused the error (for context)
   * @param inviteId - The invite ID that caused the error (for update/delete operations)
   */
  private handleInviteError(
    error: any,
    inviteData?: CreateWorkspaceInviteData,
    inviteId?: string
  ): never {
    console.error("Error in invite operation:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      const target = error.meta?.target || [];

      if (target.includes("invite_token")) {
        throw WorkspaceChannelServiceError.conflict(
          "Invite token already exists (this should not happen - token generation issue)"
        );
      }

      // Generic unique constraint violation
      throw WorkspaceChannelServiceError.conflict(
        "Invite already exists with the provided data"
      );
    }

    // Handle foreign key constraint violations
    if (error.code === "P2003") {
      const constraint = error.meta?.constraint || "";

      if (constraint.includes("workspace")) {
        throw WorkspaceChannelServiceError.notFound(
          "Workspace",
          inviteData?.workspaceId || "unknown"
        );
      }

      throw WorkspaceChannelServiceError.badRequest(
        "Invalid reference in invite data"
      );
    }

    // Handle not found errors
    if (error.code === "P2025") {
      throw WorkspaceChannelServiceError.notFound(
        "Invite",
        inviteId || "unknown"
      );
    }

    // Generic database error
    throw WorkspaceChannelServiceError.database(
      "Database operation failed for invite"
    );
  }
}
