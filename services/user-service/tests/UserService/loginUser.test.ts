import { UserService } from "../../src/services/userService";
import { AuthService } from "../../src/services/authService";
import { UserServiceError } from "../../src/types/error.types";
import { prisma } from "../../src/config/prisma";
import { redisService } from "../../src/utils/redis";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
} from "@jest/globals";
describe("AuthService.loginUser", () => {
  const testUser = {
    email: "login@example.com",
    username: "login_user",
    password: "loginpassword123",
  };

  beforeAll(async () => {
    // Clean up any existing test users with login_ prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "login_" },
      },
    });

    // Create test user for login tests
    await UserService.registerUser(testUser);
  });

  afterAll(async () => {
    // Clean up only users with login_ prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "login_" },
      },
    });
  });

  beforeEach(async () => {
    // Clear any stored refresh tokens by getting user and removing their tokens
    const user = await prisma.user.findUnique({
      where: { username: testUser.username },
    });
    if (user) {
      await redisService.removeAllRefreshTokens(user.id);
    }
  });

  it("should successfully login with email", async () => {
    const loginData = {
      identifier: testUser.email,
      password: testUser.password,
    };

    const result = await AuthService.loginUser(loginData);

    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("refresh_token");
    expect(result).toHaveProperty("expires_in");
    expect(result).toHaveProperty("user");

    expect(result.user).toMatchObject({
      email: testUser.email,
      username: testUser.username,
      roles: ["user"],
    });

    expect(typeof result.access_token).toBe("string");
    expect(typeof result.refresh_token).toBe("string");
    expect(result.access_token.length).toBeGreaterThan(0);
    expect(result.refresh_token.length).toBeGreaterThan(0);
  });

  it("should successfully login with username", async () => {
    const loginData = {
      identifier: testUser.username,
      password: testUser.password,
    };

    const result = await AuthService.loginUser(loginData);

    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("refresh_token");
    expect(result).toHaveProperty("expires_in");
    expect(result).toHaveProperty("user");

    expect(result.user).toMatchObject({
      email: testUser.email,
      username: testUser.username,
      roles: ["user"],
    });
  });

  it("should store refresh token in Redis", async () => {
    const loginData = {
      identifier: testUser.email,
      password: testUser.password,
    };

    const result = await AuthService.loginUser(loginData);

    // Get user ID to check Redis
    const user = await prisma.user.findUnique({
      where: { email: testUser.email },
    });
    expect(user).toBeTruthy();

    // Check if refresh token is stored in Redis
    const storedToken = await redisService.getRefreshToken(user!.id);
    expect(storedToken).toBe(result.refresh_token);
  });

  it("should update lastSeen timestamp", async () => {
    const loginData = {
      identifier: testUser.email,
      password: testUser.password,
    };

    const userBefore = await prisma.user.findUnique({
      where: { email: testUser.email },
    });

    // Wait a moment to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await AuthService.loginUser(loginData);

    const userAfter = await prisma.user.findUnique({
      where: { email: testUser.email },
    });

    expect(userAfter?.lastSeen).toBeDefined();
    expect(userAfter?.lastSeen?.getTime()).toBeGreaterThan(
      userBefore?.lastSeen?.getTime() || 0
    );
  });

  it("should throw error for non-existent user", async () => {
    const loginData = {
      identifier: "nonexistent@example.com",
      password: "password123",
    };

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      "Invalid credentials"
    );

    try {
      await AuthService.loginUser(loginData);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("INVALID_CREDENTIALS");
      expect((error as UserServiceError).statusCode).toBe(401);
    }
  });

  it("should throw error for wrong password", async () => {
    const loginData = {
      identifier: testUser.email,
      password: "wrongpassword",
    };

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      "Invalid credentials"
    );

    try {
      await AuthService.loginUser(loginData);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("INVALID_CREDENTIALS");
      expect((error as UserServiceError).statusCode).toBe(401);
    }
  });

  it("should throw error for deleted user", async () => {
    // Create a user and mark as deleted
    const deletedUserData = {
      email: "deleted@example.com",
      username: "login_deleted",
      password: "password123",
    };

    const user = await UserService.registerUser(deletedUserData);

    // Mark user as deleted
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    const loginData = {
      identifier: deletedUserData.email,
      password: deletedUserData.password,
    };

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      "Invalid credentials"
    );

    // Clean up
    await prisma.user.delete({
      where: { id: user.id },
    });
  });

  it("should throw error for OAuth-only user (no password)", async () => {
    // Create OAuth user (no password)
    const oauthUser = await prisma.user.create({
      data: {
        email: "oauth@example.com",
        username: "login_oauthuser",
        displayName: "OAuth User",
        passwordHash: null, // OAuth-only user
        roles: ["user"],
      },
    });

    const loginData = {
      identifier: "oauth@example.com",
      password: "anypassword",
    };

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      "Invalid credentials"
    );

    // Clean up
    await prisma.user.delete({
      where: { id: oauthUser.id },
    });
  });

  it("should return error for inActive user", async () => {
    // Create a user and mark as inactive
    const inActiveUserData = {
      email: "inactive@example.com",
      username: "login_inactive",
      password: "password123",
    };

    const user = await UserService.registerUser(inActiveUserData);

    // Mark user as inactive
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    const loginData = {
      identifier: inActiveUserData.email,
      password: inActiveUserData.password,
    };

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      UserServiceError
    );

    await expect(AuthService.loginUser(loginData)).rejects.toThrow(
      "Invalid credentials"
    );

    // Clean up
    await prisma.user.delete({
      where: { id: user.id },
    });
  });
});
