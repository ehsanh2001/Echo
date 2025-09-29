import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { User, UserProfile } from "../types/user.types";
import { RegisterRequest } from "../types/auth.types";
import { UserServiceError } from "../types/error.types";

/**
 * User management service for CRUD operations
 *
 * Provides comprehensive user management functionality including user registration,
 * profile management, and user data operations. Integrates with Prisma for database
 * operations and handles user data validation and transformation.
 *
 * Features:
 * - Secure user registration with email and username uniqueness validation
 * - Password hashing with bcrypt
 * - User profile formatting for API responses
 * - User existence validation
 *
 * Future features:
 * - User profile updates
 * - User deletion/deactivation
 * - User search and listing
 * - User role management
 *
 * ```
 */
export class UserService {
  /**
   * Registers a new user in the system
   *
   * Creates a new user account with email and username uniqueness validation and secure
   * password hashing. Returns the user profile without sensitive information.
   *
   * @param data - User registration data containing email, password, and username
   * @returns Promise resolving to the created user's profile
   *
   * @throws {UserServiceError} When email already exists (EMAIL_EXISTS)
   * @throws {UserServiceError} When username already exists (USERNAME_EXISTS)
   * @throws {UserServiceError} When database operation fails (REGISTRATION_FAILED)
   *
   * @example
   * ```typescript
   * const profile = await UserService.registerUser({
   *   email: 'john@example.com',
   *   password: 'securePassword123',
   *   username: 'johndoe',
   *   bio: 'Software developer'
   * });
   * // Returns: { id, email, username, displayName, bio, avatarUrl, createdAt, lastSeen, roles }
   * ```
   */
  static async registerUser(data: RegisterRequest): Promise<UserProfile> {
    try {
      await this.checkUserExistance(data);
      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await this.createUser(data, passwordHash);

      console.log(`User registered: ${data.email} (${user.id})`);

      return this.formatUserProfile(user);
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      throw new UserServiceError(
        "Registration failed",
        "REGISTRATION_FAILED",
        500
      );
    }
  }

  /**
   * Creates a new user in the database
   *
   * Inserts a new user record with the provided data and hashed password.
   * Sets default values for optional fields and assigns default user role.
   *
   * @param data - User registration data
   * @param passwordHash - Bcrypt hashed password
   * @returns Promise resolving to created user entity
   *
   * @example
   * ```typescript
   * const user = await this.createUser(registrationData, hashedPassword);
   * ```
   */
  private static async createUser(data: RegisterRequest, passwordHash: string) {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        username: data.username,
        displayName: data.displayName || data.username, // Use provided displayName or default to username
        bio: data.bio || null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"], // Default role
        isActive: true,
      },
    });
  }

  /**
   * Validates user uniqueness constraints
   *
   * Checks that the email and username are not already taken by existing users.
   * Throws appropriate errors if duplicates are found.
   *
   * @param user - User data to validate
   *
   * @throws {UserServiceError} When email already exists (EMAIL_EXISTS)
   * @throws {UserServiceError} When username already exists (USERNAME_EXISTS)
   *
   * @example
   * ```typescript
   * await this.checkUserExistance({
   *   email: 'john@example.com',
   *   username: 'johndoe',
   *   password: 'password123'
   * });
   * ```
   */
  private static async checkUserExistance(user: RegisterRequest) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: user.email }, { username: user.username }],
        deletedAt: null,
      },
    });

    if (existingUser) {
      if (existingUser.email === user.email) {
        throw new UserServiceError("Email already exists", "EMAIL_EXISTS", 400);
      }
      if (existingUser.username === user.username) {
        throw new UserServiceError(
          "Username already exists",
          "USERNAME_EXISTS",
          400
        );
      }
    }
  }

  /**
   * Finds active user by ID
   *
   * Retrieves user entity ensuring they are not deleted and are active.
   * This is a utility method that can be used by other services.
   *
   * @param userId - User's unique identifier
   * @returns Promise resolving to user entity
   *
   * @throws {UserServiceError} When user is not found (USER_NOT_FOUND)
   *
   * @example
   * ```typescript
   * const user = await UserService.findActiveUser('user123');
   * ```
   */
  static async findActiveUser(userId: string): Promise<User> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!user) {
      throw new UserServiceError("User not found", "USER_NOT_FOUND", 404);
    }

    return user;
  }

  /**
   * Gets user profile by ID
   *
   * Retrieves and formats user profile information for public consumption.
   *
   * @param userId - User's unique identifier
   * @returns Promise resolving to formatted user profile
   *
   * @throws {UserServiceError} When user is not found (USER_NOT_FOUND)
   *
   * @example
   * ```typescript
   * const profile = await UserService.getUserProfile('user123');
   * // Returns: { id, email, username, displayName, bio, avatarUrl, createdAt, lastSeen, roles }
   * ```
   */
  static async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await this.findActiveUser(userId);
    return this.formatUserProfile(user);
  }

  /**
   * Formats user data for API response
   *
   * Transforms internal user object to public user profile format,
   * excluding sensitive information like password hash.
   *
   * @param user - Internal user object from database
   * @returns Formatted user profile for API responses
   *
   * @example
   * ```typescript
   * const profile = this.formatUserProfile(user);
   * // Returns: { id, email, username, displayName, bio, avatarUrl, createdAt, lastSeen, roles }
   * ```
   */
  static formatUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      roles: user.roles,
    };
  }
}
