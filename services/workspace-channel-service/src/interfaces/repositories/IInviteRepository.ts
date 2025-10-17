import { Invite } from "@prisma/client";
import { CreateWorkspaceInviteData } from "../../types";

/**
 * Repository interface for invite operations
 */
export interface IInviteRepository {
  /**
   * Create a new invite
   * @param data - Invite creation data
   * @returns Promise resolving to the created invite
   */
  create(data: CreateWorkspaceInviteData): Promise<Invite>;

  /**
   * Find a pending workspace invite by email and workspace
   * Used to check for duplicate invites and invalidate old ones
   * @param email - The email address
   * @param workspaceId - The workspace ID
   * @returns Promise resolving to the invite or null if not found
   */
  findPendingByEmailAndWorkspace(
    email: string,
    workspaceId: string
  ): Promise<Invite | null>;

  /**
   * Find all pending invites
   * Used by outbox service to send/resend notifications for all pending invites
   * @returns Promise resolving to array of all pending invites
   */
  findAllPending(): Promise<Invite[]>;

  /**
   * Invalidate an invite (mark as accepted or expired)
   * @param inviteId - The invite ID to invalidate
   * @param acceptedBy - Optional user ID who accepted the invite
   * @returns Promise resolving when invalidation is complete
   */
  invalidateInvite(inviteId: string, acceptedBy?: string): Promise<void>;

  /**
   * Delete expired invites (cleanup operation)
   * Only deletes invites that are expired and not accepted
   * @param olderThan - Delete invites expired before this date
   * @returns Promise resolving to number of deleted invites
   */
  deleteUnacceptedExpired(olderThan: Date): Promise<number>;

  /**
   * Find an invite by its token
   * @param token - The invite token
   * @returns Promise resolving to the invite or null if not found
   */
  findByToken(token: string): Promise<Invite | null>;

  /**
   * Mark an invite as accepted
   * @param inviteId - The invite ID
   * @param acceptedBy - User ID who accepted the invite
   * @param acceptedAt - Timestamp of acceptance
   * @param transaction - Optional Prisma transaction context
   * @returns Promise resolving to the updated invite
   */
  markAsAccepted(
    inviteId: string,
    acceptedBy: string,
    acceptedAt: Date,
    transaction?: any
  ): Promise<Invite>;
}
