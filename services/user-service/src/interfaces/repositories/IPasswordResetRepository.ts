import {
  PasswordResetToken,
  CreatePasswordResetTokenData,
  UpdatePasswordResetTokenData,
} from "../../types/passwordReset.types";

/**
 * Password Reset Token repository interface for data access operations
 *
 * Defines the contract for password reset token persistence operations.
 * This interface abstracts the database layer and enables dependency injection
 * and easier testing through mocking.
 */
export interface IPasswordResetRepository {
  /**
   * Finds a password reset token by email
   *
   * @param email - Email address to search for
   * @returns Promise resolving to token if found, null otherwise
   */
  findByEmail(email: string): Promise<PasswordResetToken | null>;

  /**
   * Creates a new password reset token in the database
   *
   * @param data - Token data for creation
   * @returns Promise resolving to the created token entity
   */
  create(data: CreatePasswordResetTokenData): Promise<PasswordResetToken>;

  /**
   * Updates an existing password reset token
   *
   * @param email - Email address of the token to update
   * @param data - Data to update
   * @returns Promise resolving to the updated token entity
   */
  update(
    email: string,
    data: UpdatePasswordResetTokenData
  ): Promise<PasswordResetToken>;

  /**
   * Deletes a password reset token by email
   *
   * @param email - Email address of the token to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteByEmail(email: string): Promise<void>;

  /**
   * Deletes all expired password reset tokens
   * Used for cleanup operations
   *
   * @returns Promise resolving to the number of deleted tokens
   */
  deleteExpired(): Promise<number>;
}
