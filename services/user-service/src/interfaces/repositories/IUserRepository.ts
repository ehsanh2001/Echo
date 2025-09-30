import { User, CreateUserData } from "../../types/user.types";

/**
 * User repository interface for data access operations
 *
 * Defines the contract for user data persistence operations.
 * This interface abstracts the database layer and enables dependency injection
 * and easier testing through mocking.
 */
export interface IUserRepository {
  /**
   * Creates a new user in the database
   *
   * @param userData - Complete user data for creation
   * @returns Promise resolving to the created user entity
   */
  create(userData: CreateUserData): Promise<User>;

  /**
   * Finds a user by email or username
   *
   * Searches for non-deleted users matching either email or username.
   * Used for uniqueness validation during registration.
   *
   * @param email - Email address to search for
   * @param username - Username to search for
   * @returns Promise resolving to user if found, null otherwise
   */
  findByEmailOrUsername(email: string, username: string): Promise<User | null>;

  /**
   * Finds an active user by ID
   *
   * Retrieves a user that is both active and not deleted.
   * Used for operations that require an active user account.
   *
   * @param userId - Unique user identifier
   * @returns Promise resolving to user if found and active, null otherwise
   */
  findActiveById(userId: string): Promise<User | null>;

  /**
   * Finds any user by ID (including inactive/deleted)
   *
   * Retrieves a user regardless of their active status.
   * Used for operations that need to access any user record.
   *
   * @param userId - Unique user identifier
   * @returns Promise resolving to user if found, null otherwise
   */
  findById(userId: string): Promise<User | null>;
}
