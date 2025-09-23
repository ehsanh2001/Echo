import bcrypt from "bcrypt";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
import type { User, CreateUserRequest, CreateUserResponse } from "../types";

/**
 * Custom error class for user service operations
 *
 * @class UserServiceError
 * @extends {Error}
 */
export class UserServiceError extends Error {
  /**
   * Creates an instance of UserServiceError
   *
   * @param {string} message - The error message
   * @param {string} code - The error code for programmatic identification
   * @memberof UserServiceError
   */
  constructor(message: string, public code: string) {
    super(message);
    this.name = "UserServiceError";
  }
}

/**
 * Service class for user-related operations
 * Handles user registration, authentication, and profile management
 *
 * @class UserService
 */
class UserService {
  /**
   * Creates a new user account in the system
   *
   * @param {CreateUserRequest} userData - User registration data
   * @returns {Promise<CreateUserResponse>} The created user data (excluding sensitive information)
   * @throws {UserServiceError} When email/username already exists, password processing fails, or database errors occur
   * @memberof UserService
   *
   * @example
   * ```typescript
   * const newUser = await userService.createUser({
   *   email: "john@example.com",
   *   password: "securePassword123",
   *   username: "johndoe",
   *   display_name: "John Doe"
   * });
   * ```
   */
  async createUser(userData: CreateUserRequest): Promise<CreateUserResponse> {
    try {
      await this.validateUserUniqueness(userData);
      const passwordHash = await this.hashPassword(userData.password);
      const user = await this.createUserInDatabase(userData, passwordHash);
      return this.formatUserResponse(user);
    } catch (error) {
      throw this.handleCreateUserError(error);
    }
  }

  /**
   * Validates that email and username are unique in the system
   *
   * @private
   * @param {CreateUserRequest} userData - User data to validate
   * @returns {Promise<void>} Resolves if validation passes
   * @throws {UserServiceError} With code "EMAIL_EXISTS" if email is already registered
   * @throws {UserServiceError} With code "USERNAME_EXISTS" if username is already taken
   * @memberof UserService
   */
  private async validateUserUniqueness(
    userData: CreateUserRequest
  ): Promise<void> {
    const existingEmail = await this.findByEmail(userData.email);
    if (existingEmail) {
      throw new UserServiceError("Email already registered", "EMAIL_EXISTS");
    }

    const existingUsername = await this.findByUsername(userData.username);
    if (existingUsername) {
      throw new UserServiceError("Username already taken", "USERNAME_EXISTS");
    }
  }

  /**
   * Securely hashes a password using bcrypt
   *
   * @private
   * @param {string} password - Plain text password to hash
   * @returns {Promise<string>} The hashed password
   * @throws {UserServiceError} With code "PASSWORD_ERROR" if hashing fails
   * @memberof UserService
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, config.bcrypt.saltRounds);
    } catch (error) {
      throw new UserServiceError(
        "Password processing failed",
        "PASSWORD_ERROR"
      );
    }
  }

  /**
   * Creates a new user record in the database
   *
   * @private
   * @param {CreateUserRequest} userData - User registration data
   * @param {string} passwordHash - The hashed password
   * @returns {Promise<User>} The created user record from database
   * @throws {Error} Database constraint violations or connection errors
   * @memberof UserService
   */
  private async createUserInDatabase(
    userData: CreateUserRequest,
    passwordHash: string
  ): Promise<User> {
    return await prisma.user.create({
      data: {
        email: userData.email.toLowerCase().trim(),
        passwordHash,
        username: userData.username.toLowerCase().trim(),
        displayName: userData.display_name.trim(),
        status: "OFFLINE",
        isActive: true,
      },
    });
  }

  /**
   * Formats user data for API response, excluding sensitive information
   *
   * @private
   * @param {User} user - The user record from database
   * @returns {CreateUserResponse} Formatted user data safe for API response
   * @memberof UserService
   */
  private formatUserResponse(user: User): CreateUserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.displayName,
      status: user.status,
      created_at: user.createdAt,
    };
  }

  /**
   * Centralized error handling for createUser method
   * Converts various error types into appropriate UserServiceError instances
   *
   * @private
   * @param {unknown} error - The error to handle and convert
   * @returns {never} This method always throws, never returns
   * @throws {UserServiceError} With appropriate error code and message based on error type:
   *   - "EMAIL_EXISTS": Email already registered
   *   - "USERNAME_EXISTS": Username already taken
   *   - "USER_EXISTS": Generic user already exists
   *   - "PASSWORD_ERROR": Password processing failed
   *   - "DATABASE_ERROR": Generic database error
   * @memberof UserService
   */
  private handleCreateUserError(error: unknown): never {
    // Re-throw our custom errors
    if (error instanceof UserServiceError) {
      throw error;
    }

    // Handle Prisma-specific errors
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as {
        code: string;
        meta?: { target?: string[] };
      };
      // P2002 is unique constraint violation
      if (prismaError.code === "P2002") {
        const field = prismaError.meta?.target;
        if (field?.includes("email")) {
          throw new UserServiceError(
            "Email already registered",
            "EMAIL_EXISTS"
          );
        }
        if (field?.includes("username")) {
          throw new UserServiceError(
            "Username already taken",
            "USERNAME_EXISTS"
          );
        }
        throw new UserServiceError("User already exists", "USER_EXISTS");
      }
    }

    // Handle bcrypt errors
    if (error instanceof Error && error.message.includes("bcrypt")) {
      throw new UserServiceError(
        "Password processing failed",
        "PASSWORD_ERROR"
      );
    }

    // Generic database error
    console.error("Unexpected error in createUser:", error);
    throw new UserServiceError("Failed to create user", "DATABASE_ERROR");
  }

  /**
   * Finds a user by email address
   *
   * @param {string} email - Email address to search for
   * @returns {Promise<User | null>} User record if found, null otherwise
   * @memberof UserService
   *
   * @example
   * ```typescript
   * const user = await userService.findByEmail("john@example.com");
   * if (user) {
   *   console.log(`Found user: ${user.username}`);
   * }
   * ```
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
      },
    });
  }

  /**
   * Finds a user by username
   *
   * @param {string} username - Username to search for
   * @returns {Promise<User | null>} User record if found, null otherwise
   * @memberof UserService
   *
   * @example
   * ```typescript
   * const user = await userService.findByUsername("johndoe");
   * if (user) {
   *   console.log(`Found user: ${user.email}`);
   * }
   * ```
   */
  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        username: username.toLowerCase().trim(),
      },
    });
  }
}

export default new UserService();
