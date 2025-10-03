import { UserProfile } from "../../types/user.types";
import { RegisterRequest } from "../../types/user.types";

/**
 * User service interface for business logic operations
 *
 * Defines the contract for user business operations.
 * This interface abstracts the service layer and enables dependency injection
 * and easier testing through mocking.
 */
export interface IUserService {
  /**
   * Registers a new user in the system
   *
   * Creates a new user account with email and username uniqueness validation
   * and secure password hashing. Returns the user profile without sensitive information.
   *
   * @param data - User registration data containing email, password, and username
   * @returns Promise resolving to the created user's profile
   * @throws {UserServiceError} When email already exists (EMAIL_EXISTS)
   * @throws {UserServiceError} When username already exists (USERNAME_EXISTS)
   * @throws {UserServiceError} When database operation fails (REGISTRATION_FAILED)
   */
  registerUser(data: RegisterRequest): Promise<UserProfile>;

  /**
   * Retrieves a user's public profile
   *
   * Returns safe, public information about a user including roles.
   * Excludes sensitive fields like password hash and internal status fields.
   *
   * @param userId - Unique user identifier
   * @returns Promise resolving to user profile
   * @throws {UserServiceError} When user not found (USER_NOT_FOUND)
   * @throws {UserServiceError} When database operation fails (PROFILE_RETRIEVAL_FAILED)
   */
  getPublicProfile(userId: string): Promise<UserProfile>;

  /**
   * Retrieves a user's public profile by email address
   *
   * Used for user discovery and invitation flows in other microservices.
   * Returns safe, public information about an active user including roles.
   *
   * @param email - User's email address
   * @returns Promise resolving to user profile
   * @throws {UserServiceError} When email format is invalid (INVALID_EMAIL)
   * @throws {UserServiceError} When user not found (USER_NOT_FOUND)
   * @throws {UserServiceError} When database operation fails (PROFILE_RETRIEVAL_FAILED)
   */
  getPublicProfileByEmail(email: string): Promise<UserProfile>;
}
