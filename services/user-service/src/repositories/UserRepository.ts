import "reflect-metadata";
import { injectable } from "tsyringe";
import { prisma } from "../config/prisma";
import { User, CreateUserData } from "../types/user.types";
import { IUserRepository } from "../interfaces/repositories/IUserRepository";

/**
 * Prisma-based implementation of the User Repository
 *
 * Provides concrete implementation of user data access operations
 * using Prisma ORM. This class is injectable and can be used with
 * dependency injection container.
 *
 * Features:
 * - Full CRUD operations for users
 * - Soft delete support (deletedAt field)
 * - Active user filtering
 * - Email/username uniqueness checking
 */
@injectable()
export class UserRepository implements IUserRepository {
  /**
   * Creates a new user in the database
   *
   * @param userData - Complete user data for creation
   * @returns Promise resolving to the created user entity
   * @throws Error if database operation fails
   */
  async create(userData: CreateUserData): Promise<User> {
    try {
      return await prisma.user.create({
        data: userData,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error(
        `Failed to create user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

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
  async findByEmailOrUsername(
    email: string,
    username: string
  ): Promise<User | null> {
    try {
      return await prisma.user.findFirst({
        where: {
          OR: [{ email: email }, { username: username }],
          deletedAt: null, // Only find non-deleted users
          isActive: true, // Only find active users
        },
      });
    } catch (error) {
      console.error("Error finding user by email or username:", error);
      throw new Error(
        `Failed to find user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Finds an active user by ID
   *
   * Retrieves a user that is both active and not deleted.
   * Used for operations that require an active user account.
   *
   * @param userId - Unique user identifier
   * @returns Promise resolving to user if found and active, null otherwise
   */
  async findActiveById(userId: string): Promise<User | null> {
    try {
      return await prisma.user.findFirst({
        where: {
          id: userId,
          isActive: true,
          deletedAt: null,
        },
      });
    } catch (error) {
      console.error("Error finding active user by ID:", error);
      throw new Error(
        `Failed to find active user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Finds any user by ID (including inactive/deleted)
   *
   * Retrieves a user regardless of their active status.
   * Used for operations that need to access any user record.
   *
   * @param userId - Unique user identifier
   * @returns Promise resolving to user if found, null otherwise
   */
  async findById(userId: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
    } catch (error) {
      console.error("Error finding user by ID:", error);
      throw new Error(
        `Failed to find user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
