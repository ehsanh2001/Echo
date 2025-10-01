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
}
