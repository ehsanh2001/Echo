import { UserProfile } from "../../types/email";

/**
 * User service client interface
 */
export interface IUserServiceClient {
  /**
   * Get user by ID from user-service
   */
  getUserById(userId: string): Promise<UserProfile | null>;
}
