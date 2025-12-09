import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import bcrypt from "bcryptjs";
import { IUserService } from "../interfaces/services/IUserService";
import { IUserRepository } from "../interfaces/repositories/IUserRepository";
import { User, UserProfile, CreateUserData } from "../types/user.types";
import { RegisterRequest } from "../types/user.types";
import { UserServiceError } from "../types/error.types";
import logger from "../utils/logger";

/**
 * User service implementation using dependency injection
 *
 * Provides comprehensive user management functionality including user registration,
 */
@injectable()
export class UserService implements IUserService {
  constructor(
    @inject("IUserRepository") private userRepository: IUserRepository
  ) {}

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
   */
  async registerUser(data: RegisterRequest): Promise<UserProfile> {
    try {
      // Check if user already exists
      await this.checkUserExistence(data);

      // Hash password
      const passwordHash = await this.hashPassword(data.password);

      // Create user data
      const userData: CreateUserData = {
        email: data.email,
        passwordHash,
        username: data.username,
        displayName: data.displayName || data.username,
        bio: data.bio || null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      // Create user via repository
      const user = await this.userRepository.create(userData);

      logger.info("User registered", { userId: user.id, email: data.email });
      return this.formatUserProfile(user);
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      logger.error("Registration error", { error });
      throw new UserServiceError(
        "Failed to register user",
        "REGISTRATION_FAILED",
        500
      );
    }
  }

  /**
   * Retrieves a user's public profile
   *
   * Returns safe, public information about a user including roles.
   * Excludes sensitive fields like password hash and internal status fields.
   *
   * @param userId - Unique user identifier
   * @returns Promise resolving to user profile
   * @throws UserServiceError if user not found
   */
  async getPublicProfile(userId: string): Promise<UserProfile> {
    try {
      logger.info("Looking up user by ID", { userId });
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new UserServiceError("User not found", "USER_NOT_FOUND", 404);
      }

      logger.debug("Public profile retrieved", {
        targetUserId: userId,
        username: user.username,
      });
      return this.formatUserProfile(user);
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      logger.error("Error getting public profile", { error });
      throw new UserServiceError(
        "Failed to retrieve user profile",
        "PROFILE_RETRIEVAL_FAILED",
        500
      );
    }
  }

  /**
   * Retrieves a user's public profile by email address
   *
   * Used for user discovery and invitation flows in other microservices.
   * Returns safe, public information about an active user including roles.
   *
   * @param email - User's email address
   * @returns Promise resolving to user profile
   * @throws UserServiceError if email format is invalid or user not found
   */
  async getPublicProfileByEmail(email: string): Promise<UserProfile> {
    try {
      // Basic email validation
      if (!email || !this.isValidEmail(email)) {
        throw new UserServiceError(
          "Invalid email format",
          "INVALID_EMAIL",
          400
        );
      }

      const user = await this.userRepository.findByEmail(email.toLowerCase());

      if (!user) {
        throw new UserServiceError("User not found", "USER_NOT_FOUND", 404);
      }

      return this.formatUserProfile(user);
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      logger.error("Error getting public profile by email", { error });
      throw new UserServiceError(
        "Failed to retrieve user profile",
        "PROFILE_RETRIEVAL_FAILED",
        500
      );
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Formats user data for public consumption
   *
   * Transforms a user entity into a user profile by excluding sensitive information
   * like password hashes and internal database fields.
   *
   * @param user - Complete user entity from database
   * @returns User profile safe for API responses
   */
  private formatUserProfile(user: User): UserProfile {
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

  /**
   * Checks if user already exists by email or username
   *
   * @param data - Registration data to check
   * @throws {UserServiceError} When email or username already exists
   */
  private async checkUserExistence(data: RegisterRequest): Promise<void> {
    try {
      const existingUser = await this.userRepository.findByEmailOrUsername(
        data.email,
        data.username
      );

      if (existingUser) {
        if (existingUser.email === data.email) {
          throw new UserServiceError(
            "Email already exists",
            "EMAIL_EXISTS",
            400
          );
        }
        if (existingUser.username === data.username) {
          throw new UserServiceError(
            "Username already exists",
            "USERNAME_EXISTS",
            400
          );
        }
      }
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      logger.error("Error checking user existence", { error });
      throw new UserServiceError(
        "Failed to validate user data",
        "VALIDATION_FAILED",
        500
      );
    }
  }

  /**
   * Hashes a password using bcrypt
   *
   * @param password - Plain text password
   * @returns Promise resolving to hashed password
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, 12);
    } catch (error) {
      logger.error("Error hashing password", { error });
      throw new UserServiceError(
        "Failed to process password",
        "PASSWORD_HASH_FAILED",
        500
      );
    }
  }

  /**
   * Validates email format using regex
   *
   * @param email - Email address to validate
   * @returns True if email format is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
