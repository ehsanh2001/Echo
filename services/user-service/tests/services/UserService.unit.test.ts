import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { UserService } from "../../src/services/userService";
import { IUserRepository } from "../../src/interfaces/repositories/IUserRepository";
import { User } from "../../src/types/user.types";
import { RegisterRequest } from "../../src/types/user.types";
import { UserServiceError } from "../../src/types/error.types";
import bcrypt from "bcryptjs";

// Mock bcrypt module
// Note: 'as never' is used because Jest's mock typing for bcrypt doesn't perfectly align
// with TypeScript's strict type checking. This is a common pattern in Jest testing.
jest.mock("bcryptjs");
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("UserService (Unit Tests with Mocks)", () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    // Create mock repository
    mockUserRepository = {
      create: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      findActiveById: jest.fn(),
      findById: jest.fn(),
      updateLastSeen: jest.fn(),
    };

    // Create service with mocked repository
    userService = new UserService(mockUserRepository);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    const mockUser: User = {
      id: "test-user-id",
      email: "test@example.com",
      passwordHash: "$2b$10$hashedpassword",
      username: "testuser",
      displayName: "Test User",
      bio: "Test bio",
      avatarUrl: null,
      lastSeen: null,
      deletedAt: null,
      roles: ["user"],
      isActive: true,
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
      updatedAt: new Date("2023-01-01T00:00:00.000Z"),
    };

    const registerData: RegisterRequest = {
      email: "test@example.com",
      password: "securePassword123",
      username: "testuser",
      displayName: "Test User",
      bio: "Test bio",
    };

    it("should successfully register a new user", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue(
        "$2b$10$hashedpassword" as never
      );
      mockUserRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await userService.registerUser(registerData);

      // Assert
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        registerData.email,
        registerData.username
      );
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerData.password, 12);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: registerData.email,
        passwordHash: "$2b$10$hashedpassword",
        username: registerData.username,
        displayName: registerData.displayName,
        bio: registerData.bio,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      });

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        displayName: mockUser.displayName,
        bio: mockUser.bio,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt,
        lastSeen: mockUser.lastSeen,
        roles: mockUser.roles,
      });
    });

    it("should register user without optional fields", async () => {
      // Arrange
      const minimalRegisterData: RegisterRequest = {
        email: "minimal@example.com",
        password: "password123",
        username: "minimaluser",
      };

      const minimalUser: User = {
        ...mockUser,
        email: "minimal@example.com",
        username: "minimaluser",
        displayName: "minimaluser", // Should default to username
        bio: null,
      };

      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue(
        "$2b$10$hashedpassword" as never
      );
      mockUserRepository.create.mockResolvedValue(minimalUser);

      // Act
      const result = await userService.registerUser(minimalRegisterData);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: minimalRegisterData.email,
        passwordHash: "$2b$10$hashedpassword",
        username: minimalRegisterData.username,
        displayName: minimalRegisterData.username, // Should default to username
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      });

      expect(result.displayName).toBe(minimalRegisterData.username);
      expect(result.bio).toBeNull();
    });

    it("should throw error when email already exists", async () => {
      // Arrange
      const existingUser: User = { ...mockUser, email: registerData.email };
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        UserServiceError
      );
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        "Email already exists"
      );

      // Verify repository methods were called correctly
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        registerData.email,
        registerData.username
      );
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it("should throw error when username already exists", async () => {
      // Arrange
      const existingUser: User = {
        ...mockUser,
        username: registerData.username,
        email: "different@example.com", // Different email to trigger username check
      };
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        UserServiceError
      );
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        "Username already exists"
      );

      // Verify repository methods were called correctly
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        registerData.email,
        registerData.username
      );
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it("should throw error when password hashing fails", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      (mockBcrypt.hash as jest.Mock).mockRejectedValue(
        new Error("Hashing failed") as never
      );

      // Act & Assert
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        UserServiceError
      );
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        "Failed to process password"
      );

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it("should throw error when repository create fails", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue(
        "$2b$10$hashedpassword" as never
      );
      mockUserRepository.create.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        UserServiceError
      );
      await expect(userService.registerUser(registerData)).rejects.toThrow(
        "Failed to register user"
      );
    });

    // Note: Case sensitivity testing would be handled at the repository level
    // where the actual database queries with case-insensitive matching would occur
  });

  describe("formatUserProfile (private method)", () => {
    it("should be tested indirectly through registerUser", async () => {
      // This test verifies that the private formatUserProfile method works correctly
      // by checking the output of registerUser which calls it internally

      const mockUser: User = {
        id: "test-user-id",
        email: "test@example.com",
        passwordHash: "$2b$10$hashedpassword",
        username: "testuser",
        displayName: "Test User",
        bio: "Test bio",
        avatarUrl: "https://example.com/avatar.jpg",
        lastSeen: new Date("2023-01-01T12:00:00.000Z"),
        deletedAt: null,
        roles: ["user", "premium"],
        isActive: true,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
      };

      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue(
        "$2b$10$hashedpassword" as never
      );
      mockUserRepository.create.mockResolvedValue(mockUser);

      const registerData: RegisterRequest = {
        email: "test@example.com",
        password: "securePassword123",
        username: "testuser",
        displayName: "Test User",
        bio: "Test bio",
      };

      // Act
      const result = await userService.registerUser(registerData);

      // Assert - Verify formatUserProfile worked correctly (sensitive fields excluded)
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        displayName: mockUser.displayName,
        bio: mockUser.bio,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt,
        lastSeen: mockUser.lastSeen,
        roles: mockUser.roles,
      });

      // Verify sensitive fields are not included
      expect((result as any).passwordHash).toBeUndefined();
      expect((result as any).deletedAt).toBeUndefined();
      expect((result as any).isActive).toBeUndefined();
      expect((result as any).updatedAt).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw UserServiceError with correct error codes", async () => {
      const registerData: RegisterRequest = {
        email: "test@example.com",
        password: "password123",
        username: "testuser",
      };

      // Test email exists error
      const existingEmailUser: User = {
        id: "existing-id",
        email: "test@example.com",
        passwordHash: "hash",
        username: "differentuser",
        displayName: "Different User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findByEmailOrUsername.mockResolvedValue(
        existingEmailUser
      );

      try {
        await userService.registerUser(registerData);
        fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        expect((error as UserServiceError).code).toBe("EMAIL_EXISTS");
        expect((error as UserServiceError).statusCode).toBe(400);
      }
    });
  });

  describe("getPublicProfile", () => {
    const mockUser: User = {
      id: "user-123",
      email: "john@example.com",
      passwordHash: "$2b$10$secrethash",
      username: "johndoe",
      displayName: "John Doe",
      bio: "Software developer",
      avatarUrl: "https://example.com/avatar.jpg",
      lastSeen: new Date("2024-01-15T10:30:00.000Z"),
      deletedAt: null,
      roles: ["user", "developer"],
      isActive: true,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    it("should return public profile for existing user", async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser as never);

      const result = await userService.getPublicProfile("user-123");

      expect(result).toEqual({
        id: "user-123",
        email: "john@example.com",
        username: "johndoe",
        displayName: "John Doe",
        bio: "Software developer",
        avatarUrl: "https://example.com/avatar.jpg",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        lastSeen: new Date("2024-01-15T10:30:00.000Z"),
        roles: ["user", "developer"],
        // Note: passwordHash, isActive, deletedAt, updatedAt should NOT be present
      });

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
    });

    it("should throw UserServiceError when user not found", async () => {
      mockUserRepository.findById.mockResolvedValue(null as never);

      try {
        await userService.getPublicProfile("nonexistent");
        fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        expect((error as UserServiceError).message).toBe("User not found");
        expect((error as UserServiceError).code).toBe("USER_NOT_FOUND");
        expect((error as UserServiceError).statusCode).toBe(404);
      }

      expect(mockUserRepository.findById).toHaveBeenCalledWith("nonexistent");
    });

    it("should throw UserServiceError when repository throws error", async () => {
      const dbError = new Error("Database connection failed");
      mockUserRepository.findById.mockRejectedValue(dbError as never);

      try {
        await userService.getPublicProfile("user-123");
        fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        expect((error as UserServiceError).message).toBe(
          "Failed to retrieve user profile"
        );
        expect((error as UserServiceError).code).toBe(
          "PROFILE_RETRIEVAL_FAILED"
        );
        expect((error as UserServiceError).statusCode).toBe(500);
      }

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
    });

    it("should exclude sensitive fields from response", async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser as never);

      const result = await userService.getPublicProfile("user-123");

      // Ensure sensitive fields are not included
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("isActive");
      expect(result).not.toHaveProperty("deletedAt");
      expect(result).not.toHaveProperty("updatedAt");
    });
  });
});
