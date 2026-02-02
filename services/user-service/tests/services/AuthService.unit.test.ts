import "reflect-metadata";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock config module before importing AuthService
jest.mock("../../src/config/env", () => ({
  config: {
    database: {
      url: "postgresql://postgres:postgres@localhost:5432/users_db_test",
    },
    jwt: {
      secret: "test-jwt-secret",
      accessTokenExpirySeconds: 900,
      refreshTokenExpirySeconds: 604800,
    },
    service: {
      name: "user-service",
      port: 8001,
    },
    redis: {
      url: "redis://localhost:6379",
    },
    security: {
      bcryptSaltRounds: 10,
    },
  },
}));

import { AuthService } from "../../src/services/authService";
import { IUserRepository } from "../../src/interfaces/repositories/IUserRepository";
import { User } from "../../src/types/user.types";
import { LoginRequest } from "../../src/types/auth.types";
import { UserServiceError } from "../../src/types/error.types";
import bcrypt from "bcryptjs";
import { redisService } from "../../src/utils/redis";
import { JWTService } from "../../src/utils/jwt";

// Mock external dependencies
jest.mock("bcryptjs");
jest.mock("../../src/utils/redis");
jest.mock("../../src/utils/jwt");

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockRedisService = redisService as jest.Mocked<typeof redisService>;
const mockJWTService = JWTService as jest.Mocked<typeof JWTService>;

describe("AuthService (Unit Tests with Mocks)", () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    // Create mock repository
    mockUserRepository = {
      create: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      findActiveById: jest.fn(),
      findById: jest.fn(),
      updateLastSeen: jest.fn(),
      findByEmail: jest.fn(),
      findByIds: jest.fn(),
      updatePassword: jest.fn(),
    };

    // Create service with mocked repository
    authService = new AuthService(mockUserRepository);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("loginUser", () => {
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

    const loginData: LoginRequest = {
      identifier: "test@example.com",
      password: "securePassword123",
    };

    it("should successfully login a user", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockJWTService.generateTokenPair.mockReturnValue({
        accessToken: "access.token.here",
        refreshToken: "refresh.token.here",
      } as never);
      mockRedisService.storeRefreshToken.mockResolvedValue(undefined as never);
      mockUserRepository.updateLastSeen.mockResolvedValue(undefined);

      // Act
      const result = await authService.loginUser(loginData);

      // Assert
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        loginData.identifier,
        loginData.identifier,
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginData.password,
        mockUser.passwordHash,
      );
      expect(mockJWTService.generateTokenPair).toHaveBeenCalled();
      expect(mockRedisService.storeRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        "refresh.token.here",
      );
      expect(mockUserRepository.updateLastSeen).toHaveBeenCalledWith(
        mockUser.id,
      );

      expect(result).toEqual({
        access_token: "access.token.here",
        refresh_token: "refresh.token.here",
        expires_in: 900,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          displayName: mockUser.displayName,
          bio: mockUser.bio,
          avatarUrl: mockUser.avatarUrl,
          createdAt: mockUser.createdAt,
          lastSeen: mockUser.lastSeen,
          roles: mockUser.roles,
        },
      });
    });

    it("should throw error when user is not found", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.loginUser(loginData)).rejects.toThrow(
        UserServiceError,
      );
      await expect(authService.loginUser(loginData)).rejects.toThrow(
        "Invalid credentials",
      );

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(mockRedisService.storeRefreshToken).not.toHaveBeenCalled();
    });

    it("should throw error when password is invalid", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      // Act & Assert
      await expect(authService.loginUser(loginData)).rejects.toThrow(
        UserServiceError,
      );
      await expect(authService.loginUser(loginData)).rejects.toThrow(
        "Invalid credentials",
      );

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginData.password,
        mockUser.passwordHash,
      );
      expect(mockRedisService.storeRefreshToken).not.toHaveBeenCalled();
    });

    it("should throw error when bcrypt comparison fails", async () => {
      // Arrange
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockRejectedValue(
        new Error("Bcrypt error") as never,
      );

      // Act & Assert
      await expect(authService.loginUser(loginData)).rejects.toThrow(
        UserServiceError,
      );
      await expect(authService.loginUser(loginData)).rejects.toThrow(
        "Login failed",
      );
    });
  });

  describe("logoutUser", () => {
    it("should successfully logout a user", async () => {
      // Arrange
      const userId = "test-user-id";
      mockRedisService.removeRefreshToken.mockResolvedValue(undefined as never);

      // Act
      await authService.logoutUser(userId);

      // Assert
      expect(mockRedisService.removeRefreshToken).toHaveBeenCalledWith(userId);
    });

    it("should throw error when redis operation fails", async () => {
      // Arrange
      const userId = "test-user-id";
      mockRedisService.removeRefreshToken.mockRejectedValue(
        new Error("Redis error") as never,
      );

      // Act & Assert
      await expect(authService.logoutUser(userId)).rejects.toThrow(
        UserServiceError,
      );
      await expect(authService.logoutUser(userId)).rejects.toThrow(
        "Logout failed",
      );
    });
  });
});
