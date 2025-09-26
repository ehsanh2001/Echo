/**
 * User-related types and interfaces
 *
 * This module defines TypeScript interfaces for user entities
 * and user profile information.
 */

/**
 * Base user interface matching Prisma database schema
 *
 * Represents the complete user entity as stored in the database,
 * including all fields and timestamps.
 *
 */
export interface User {
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
}

/**
 * Public user profile information
 *
 * Contains user data safe for public consumption, excluding sensitive
 * information like password hashes or internal database fields.
 *
 */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  lastSeen: Date | null;
  roles: string[];
}
