/**
 * User-related types and interfaces
 *
 * This module defines TypeScript interfaces for user entities
 * and user profile information.
 */

/**
 * Base user type matching Prisma database schema
 *
 * Represents the complete user entity as stored in the database,
 * including all fields and timestamps.
 *
 */
export type User = {
  id: string;
  email: string;
  passwordHash: string | null; // null for OAuth-only users
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  lastSeen: Date | null;
  deletedAt: Date | null;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Public user profile information
 *
 * Contains user data safe for public consumption, excluding sensitive
 * information like password hashes or internal database fields.
 *
 */
export type UserProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  lastSeen: Date | null;
  roles: string[];
};

/**
 * Data required to create a new user
 *
 * Contains all fields needed for user creation in the database.
 * Excludes auto-generated fields like id, createdAt, updatedAt.
 */
export type CreateUserData = Omit<User, "id" | "createdAt" | "updatedAt">;

/**
 * Data for updating an existing user
 *
 * All fields are optional since updates can be partial.
 * Excludes id and createdAt which should not be updated.
 */
export type UpdateUserData = Partial<Omit<User, "id" | "createdAt">>;

/**
 * Search criteria for finding users
 *
 * Contains fields commonly used for user lookup operations.
 */
export type UserSearchCriteria = Partial<
  Pick<User, "email" | "username" | "id">
>;

/**
 * User registration request payload
 *
 * Contains all required and optional fields for creating a new user account.
 */
export type RegisterRequest = {
  email: string;
  password: string;
  username: string;
  displayName?: string;
  bio?: string;
};
