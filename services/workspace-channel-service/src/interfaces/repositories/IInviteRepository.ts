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
   * @param olderThan - Delete invites expired before this date
   * @returns Promise resolving to number of deleted invites
   */
  deleteExpired(olderThan: Date): Promise<number>;
}
