import { UserProfile } from "../../types";

/**
 * Interface for external user service client
 */
export interface IUserServiceClient {
  /**
   * Get a user profile by user ID
   * @param userId - The user ID
   * @returns Promise resolving to user profile or null if not found
   */
  getUserProfile(userId: string): Promise<UserProfile | null>;
}
