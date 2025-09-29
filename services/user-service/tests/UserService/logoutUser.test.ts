import { UserService } from "../../src/services/userService";
import { AuthService } from "../../src/services/authService";
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
describe("AuthService.logoutUser", () => {
  const testUser = {
    email: "logout@example.com",
    username: "logout_user",
    password: "logoutpassword123",
  };

  let userId: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    // Clean up any existing test users with 'logout_' prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "logout_" },
      },
    });

    // Create test user
    const user = await UserService.registerUser(testUser);
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up only users with logout_ prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "logout_" },
      },
    });
  });

  beforeEach(async () => {
    // Login to get fresh tokens for each test
    const loginResult = await AuthService.loginUser({
      identifier: testUser.email,
      password: testUser.password,
    });
    validRefreshToken = loginResult.refresh_token;
  });

  it("should successfully logout user", async () => {
    // Verify token exists in Redis before logout
    const tokenBefore = await redisService.getRefreshToken(userId);
    expect(tokenBefore).toBe(validRefreshToken);

    // Logout user
    await expect(AuthService.logoutUser(userId)).resolves.not.toThrow();

    // Verify token is removed from Redis after logout
    const tokenAfter = await redisService.getRefreshToken(userId);
    expect(tokenAfter).toBeNull();
  });

  it("should succeed with non-existent user ID", async () => {
    const nonExistentUserId = "00000000-0000-0000-0000-000000000000";

    // Should not throw error even for non-existent user
    await expect(
      AuthService.logoutUser(nonExistentUserId)
    ).resolves.not.toThrow();
  });

  it("should handle multiple logout calls for same user", async () => {
    // Store token
    await redisService.storeRefreshToken(userId, validRefreshToken);

    // First logout
    await AuthService.logoutUser(userId);

    // Second logout should not throw error
    await expect(AuthService.logoutUser(userId)).resolves.not.toThrow();

    // Token should still be removed (idempotent)
    const tokenAfter = await redisService.getRefreshToken(userId);
    expect(tokenAfter).toBeNull();
  });

  it("should only remove tokens for specified user", async () => {
    // Create second test user
    const secondUser = {
      email: "logout2@example.com",
      username: "logout_user2",
      password: "password123",
    };

    const secondUserProfile = await UserService.registerUser(secondUser);
    const secondUserLogin = await AuthService.loginUser({
      identifier: secondUser.email,
      password: secondUser.password,
    });

    // Store tokens for both users
    await redisService.storeRefreshToken(userId, validRefreshToken);
    await redisService.storeRefreshToken(
      secondUserProfile.id,
      secondUserLogin.refresh_token
    );

    // Logout first user
    await AuthService.logoutUser(userId);

    // First user's token should be removed
    const firstUserToken = await redisService.getRefreshToken(userId);
    expect(firstUserToken).toBeNull();

    // Second user's token should still exist
    const secondUserToken = await redisService.getRefreshToken(
      secondUserProfile.id
    );
    expect(secondUserToken).toBe(secondUserLogin.refresh_token);

    // Clean up second user
    await redisService.removeRefreshToken(secondUserProfile.id);
    await prisma.user.delete({
      where: { id: secondUserProfile.id },
    });
  });
});
