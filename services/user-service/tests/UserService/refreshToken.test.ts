import { UserService } from "../../src/services/userService";
import { AuthService } from "../../src/services/authService";
import { UserServiceError } from "../../src/types/error.types";
import { prisma } from "../../src/config/prisma";
import { redisService } from "../../src/utils/redis";
import { JWTService } from "../../src/utils/jwt";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
} from "@jest/globals";
describe("AuthService.refreshToken", () => {
  const testUser = {
    email: "refresh@example.com",
    username: "refresh_user",
    password: "refreshpassword123",
  };

  let userId: string;

  beforeAll(async () => {
    // Clean up any existing test users with 'refresh_' prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "refresh_" },
      },
    });

    // Create test user
    const user = await UserService.registerUser(testUser);
    userId = user.id;
  });

  // Helper function to get a fresh refresh token
  const getFreshRefreshToken = async (): Promise<string> => {
    const loginResult = await AuthService.loginUser({
      identifier: testUser.email,
      password: testUser.password,
    });
    return loginResult.refresh_token;
  };

  afterAll(async () => {
    // Clean up only users with refresh_ prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "refresh_" },
      },
    });
  });

  it("should successfully refresh token with valid refresh token", async () => {
    const validRefreshToken = await getFreshRefreshToken();

    // Wait a moment to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 1010)); // Wait more than 1 second

    const result = await AuthService.refreshToken(validRefreshToken);

    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("refresh_token");
    expect(result).toHaveProperty("expires_in");

    expect(typeof result.access_token).toBe("string");
    expect(typeof result.refresh_token).toBe("string");
    expect(result.access_token.length).toBeGreaterThan(0);
    expect(result.refresh_token.length).toBeGreaterThan(0);

    // New tokens should be different from old ones
    expect(result.refresh_token).not.toBe(validRefreshToken);
  });

  it("should store new refresh token in Redis", async () => {
    const validRefreshToken = await getFreshRefreshToken();

    // Wait a moment to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 1010));

    const result = await AuthService.refreshToken(validRefreshToken);

    // Check if new refresh token is stored in Redis
    const storedToken = await redisService.getRefreshToken(userId);
    expect(storedToken).toBe(result.refresh_token);

    // Old token should be replaced
    expect(storedToken).not.toBe(validRefreshToken);
  });

  it("should throw error for invalid refresh token", async () => {
    const invalidToken = "invalid.token.here";

    await expect(AuthService.refreshToken(invalidToken)).rejects.toThrow(
      UserServiceError
    );

    try {
      await AuthService.refreshToken(invalidToken);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("REFRESH_FAILED");
      expect((error as UserServiceError).statusCode).toBe(500);
    }
  });

  it("should throw error for expired refresh token", async () => {
    // Create an expired token using the special test method
    const expiredTokenPayload = {
      userId: userId,
      email: testUser.email,
      roles: ["user"],
    };

    const expiredToken = JWTService.generateExpiredToken(
      expiredTokenPayload,
      "refresh"
    );

    // Store the expired token in Redis first so it passes the Redis check
    await redisService.storeRefreshToken(userId, expiredToken);

    await expect(AuthService.refreshToken(expiredToken)).rejects.toThrow(
      UserServiceError
    );
  });

  it("should throw error when refresh token not in Redis", async () => {
    // Create a valid JWT token but don't store it in Redis
    const tokenPayload = {
      userId: userId,
      email: testUser.email,
      roles: ["user"],
    };

    const validJwtToken =
      JWTService.generateTokenPair(tokenPayload).refreshToken;

    await expect(AuthService.refreshToken(validJwtToken)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.refreshToken(validJwtToken)).rejects.toThrow(
      "Invalid refresh token"
    );

    try {
      await AuthService.refreshToken(validJwtToken);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("INVALID_REFRESH_TOKEN");
      expect((error as UserServiceError).statusCode).toBe(401);
    }
  });

  it("should throw error when user not found", async () => {
    // Create a token for non-existent user
    const nonExistentUserId = "00000000-0000-0000-0000-000000000000";
    const tokenPayload = {
      userId: nonExistentUserId,
      email: "nonexistent@example.com",
      roles: ["user"],
    };

    const token = JWTService.generateTokenPair(tokenPayload).refreshToken;

    // Store the token in Redis to pass the first check
    await redisService.storeRefreshToken(nonExistentUserId, token);

    await expect(AuthService.refreshToken(token)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.refreshToken(token)).rejects.toThrow(
      "User not found"
    );

    try {
      await AuthService.refreshToken(token);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("USER_NOT_FOUND");
      expect((error as UserServiceError).statusCode).toBe(404);
    }

    // Clean up
    await redisService.removeRefreshToken(nonExistentUserId);
  });

  it("should throw error when user is deleted", async () => {
    // Create a new user and delete them
    const deletedUserData = {
      email: "deleted-refresh@example.com",
      username: "refresh_deleted",
      password: "password123",
    };

    const deletedUser = await UserService.registerUser(deletedUserData);

    // Login to get tokens
    const loginResult = await AuthService.loginUser({
      identifier: deletedUserData.email,
      password: deletedUserData.password,
    });

    // Mark user as deleted
    await prisma.user.update({
      where: { id: deletedUser.id },
      data: { deletedAt: new Date() },
    });

    await expect(
      AuthService.refreshToken(loginResult.refresh_token)
    ).rejects.toThrow(UserServiceError);

    await expect(
      AuthService.refreshToken(loginResult.refresh_token)
    ).rejects.toThrow("User not found");

    // Clean up
    await prisma.user.delete({
      where: { id: deletedUser.id },
    });
  });

  it("should throw error when user is inactive", async () => {
    // Create a new user and delete them
    const inactiveUserData = {
      email: "inactive-refresh@example.com",
      username: "refresh_inactive",
      password: "password123",
    };

    const inactiveUser = await UserService.registerUser(inactiveUserData);

    // Login to get tokens
    const loginResult = await AuthService.loginUser({
      identifier: inactiveUserData.email,
      password: inactiveUserData.password,
    });

    // Mark user as inactive
    await prisma.user.update({
      where: { id: inactiveUser.id },
      data: { isActive: false },
    });

    await expect(
      AuthService.refreshToken(loginResult.refresh_token)
    ).rejects.toThrow(UserServiceError);

    await expect(
      AuthService.refreshToken(loginResult.refresh_token)
    ).rejects.toThrow("User not found");

    // Clean up
    await prisma.user.delete({
      where: { id: inactiveUser.id },
    });
  });

  it("should handle token mismatch between JWT and Redis", async () => {
    const validRefreshToken = await getFreshRefreshToken();

    // Store different token in Redis than what we're sending
    const storedToken = "different.stored.token";
    await redisService.storeRefreshToken(userId, storedToken);

    await expect(AuthService.refreshToken(validRefreshToken)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.refreshToken(validRefreshToken)).rejects.toThrow(
      "Invalid refresh token"
    );

    try {
      await AuthService.refreshToken(validRefreshToken);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("INVALID_REFRESH_TOKEN");
      expect((error as UserServiceError).statusCode).toBe(401);
    }
  });
});
