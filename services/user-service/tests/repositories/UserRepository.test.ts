import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { container } from "../../src/container";
import { IUserRepository } from "../../src/interfaces/repositories/IUserRepository";
import { UserRepository } from "../../src/repositories/UserRepository";
import { User, CreateUserData } from "../../src/types/user.types";
import { prisma } from "../../src/config/prisma";

describe("UserRepository", () => {
  let userRepository: IUserRepository;

  beforeEach(async () => {
    // Clean up test data - delete users with repo_test_ prefix
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "repo_test_" },
      },
    });

    // Get repository instance from container
    userRepository = container.resolve<IUserRepository>("IUserRepository");
  });

  afterAll(async () => {
    // Final cleanup - delete all test users
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: "repo_test_" },
      },
    });
  });

  describe("create", () => {
    it("should successfully create a new user", async () => {
      // Arrange
      const userData: CreateUserData = {
        email: "repo_test_create@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_create_user",
        displayName: "Test Create User",
        bio: "Test user for create operation",
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      // Act
      const createdUser = await userRepository.create(userData);

      // Assert
      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.username).toBe(userData.username);
      expect(createdUser.displayName).toBe(userData.displayName);
      expect(createdUser.bio).toBe(userData.bio);
      expect(createdUser.passwordHash).toBe(userData.passwordHash);
      expect(createdUser.roles).toEqual(userData.roles);
      expect(createdUser.isActive).toBe(true);
      expect(createdUser.createdAt).toBeDefined();
      expect(createdUser.updatedAt).toBeDefined();
      expect(createdUser.deletedAt).toBeNull();
    });

    it("should throw error when creating user with duplicate email", async () => {
      // Arrange
      const userData: CreateUserData = {
        email: "repo_test_duplicate@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_duplicate_user1",
        displayName: "Test User 1",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      // Create first user
      await userRepository.create(userData);

      // Try to create second user with same email but different username
      const duplicateUserData: CreateUserData = {
        ...userData,
        username: "repo_test_duplicate_user2",
      };

      // Act & Assert
      await expect(userRepository.create(duplicateUserData)).rejects.toThrow();
    });

    it("should throw error when creating user with duplicate username", async () => {
      // Arrange
      const userData: CreateUserData = {
        email: "repo_test_unique1@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_duplicate_username",
        displayName: "Test User 1",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      // Create first user
      await userRepository.create(userData);

      // Try to create second user with same username but different email
      const duplicateUserData: CreateUserData = {
        ...userData,
        email: "repo_test_unique2@example.com",
      };

      // Act & Assert
      await expect(userRepository.create(duplicateUserData)).rejects.toThrow();
    });
  });

  describe("findByEmailOrUsername", () => {
    let testUser: User;

    beforeEach(async () => {
      // Create a test user for find operations
      const userData: CreateUserData = {
        email: "repo_test_find@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_find_user",
        displayName: "Test Find User",
        bio: "Test user for find operations",
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };
      testUser = await userRepository.create(userData);
    });

    it("should find user by email", async () => {
      // Act
      const foundUser = await userRepository.findByEmailOrUsername(
        testUser.email,
        "nonexistent_username"
      );

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe(testUser.email);
      expect(foundUser!.username).toBe(testUser.username);
    });

    it("should find user by username", async () => {
      // Act
      const foundUser = await userRepository.findByEmailOrUsername(
        "nonexistent@example.com",
        testUser.username
      );

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe(testUser.email);
      expect(foundUser!.username).toBe(testUser.username);
    });

    it("should return null when user not found", async () => {
      // Act
      const foundUser = await userRepository.findByEmailOrUsername(
        "nonexistent@example.com",
        "nonexistent_username"
      );

      // Assert
      expect(foundUser).toBeNull();
    });

    it("should not find deleted users", async () => {
      // Arrange - mark user as deleted
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: new Date() },
      });

      // Act
      const foundUser = await userRepository.findByEmailOrUsername(
        testUser.email,
        testUser.username
      );

      // Assert
      expect(foundUser).toBeNull();
    });
  });

  describe("findActiveById", () => {
    let activeUser: User;
    let inactiveUser: User;
    let deletedUser: User;

    beforeEach(async () => {
      // Create active user
      const activeUserData: CreateUserData = {
        email: "repo_test_active@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_active_user",
        displayName: "Active User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };
      activeUser = await userRepository.create(activeUserData);

      // Create inactive user
      const inactiveUserData: CreateUserData = {
        email: "repo_test_inactive@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_inactive_user",
        displayName: "Inactive User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: false, // Inactive
      };
      inactiveUser = await userRepository.create(inactiveUserData);

      // Create deleted user
      const deletedUserData: CreateUserData = {
        email: "repo_test_deleted@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_deleted_user",
        displayName: "Deleted User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: new Date(), // Deleted
        roles: ["user"],
        isActive: true,
      };
      deletedUser = await userRepository.create(deletedUserData);
    });

    it("should find active user by ID", async () => {
      // Act
      const foundUser = await userRepository.findActiveById(activeUser.id);

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(activeUser.id);
      expect(foundUser!.isActive).toBe(true);
      expect(foundUser!.deletedAt).toBeNull();
    });

    it("should not find inactive user", async () => {
      // Act
      const foundUser = await userRepository.findActiveById(inactiveUser.id);

      // Assert
      expect(foundUser).toBeNull();
    });

    it("should not find deleted user", async () => {
      // Act
      const foundUser = await userRepository.findActiveById(deletedUser.id);

      // Assert
      expect(foundUser).toBeNull();
    });

    it("should return null for non-existent user ID", async () => {
      // Act
      const foundUser = await userRepository.findActiveById("non-existent-id");

      // Assert
      expect(foundUser).toBeNull();
    });
  });

  describe("findById", () => {
    let testUser: User;

    beforeEach(async () => {
      // Create a test user
      const userData: CreateUserData = {
        email: "repo_test_findbyid@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_findbyid_user",
        displayName: "Test FindById User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };
      testUser = await userRepository.create(userData);
    });

    it("should find user by ID regardless of active status", async () => {
      // Act
      const foundUser = await userRepository.findById(testUser.id);

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe(testUser.email);
      expect(foundUser!.username).toBe(testUser.username);
    });

    it("should find inactive user by ID", async () => {
      // Arrange - make user inactive
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false },
      });

      // Act
      const foundUser = await userRepository.findById(testUser.id);

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.isActive).toBe(false);
    });

    it("should find deleted user by ID", async () => {
      // Arrange - mark user as deleted
      const deletedAt = new Date();
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt },
      });

      // Act
      const foundUser = await userRepository.findById(testUser.id);

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.deletedAt).toEqual(deletedAt);
    });

    it("should return null for non-existent user ID", async () => {
      // Act
      const foundUser = await userRepository.findById("non-existent-id");

      // Assert
      expect(foundUser).toBeNull();
    });
  });

  describe("integration tests", () => {
    it("should work with dependency injection container", async () => {
      // Act
      const repoFromContainer =
        container.resolve<IUserRepository>("IUserRepository");

      // Assert
      expect(repoFromContainer).toBeInstanceOf(UserRepository);
      expect(repoFromContainer).toBe(userRepository); // Should be singleton
    });

    it("should handle concurrent operations correctly", async () => {
      // Arrange
      const userData1: CreateUserData = {
        email: "repo_test_concurrent1@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_concurrent_user1",
        displayName: "Concurrent User 1",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const userData2: CreateUserData = {
        email: "repo_test_concurrent2@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_concurrent_user2",
        displayName: "Concurrent User 2",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      // Act - create users concurrently
      const [user1, user2] = await Promise.all([
        userRepository.create(userData1),
        userRepository.create(userData2),
      ]);

      // Assert
      expect(user1.id).toBeDefined();
      expect(user2.id).toBeDefined();
      expect(user1.id).not.toBe(user2.id);
      expect(user1.email).toBe(userData1.email);
      expect(user2.email).toBe(userData2.email);
    });
  });

  describe("findByEmail", () => {
    let testUser: User;

    beforeEach(async () => {
      // Create a test user for findByEmail tests
      const userData: CreateUserData = {
        email: "repo_test_findemail@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_findemail_user",
        displayName: "Test FindEmail User",
        bio: "Test user for findByEmail operation",
        avatarUrl: "https://example.com/avatar.jpg",
        lastSeen: new Date("2024-01-10T10:00:00.000Z"),
        deletedAt: null,
        roles: ["user", "tester"],
        isActive: true,
      };

      testUser = await userRepository.create(userData);
    });

    it("should find user by exact email match", async () => {
      // Act
      const foundUser = await userRepository.findByEmail(
        "repo_test_findemail@example.com"
      );

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe("repo_test_findemail@example.com");
      expect(foundUser!.username).toBe("repo_test_findemail_user");
      expect(foundUser!.displayName).toBe("Test FindEmail User");
      expect(foundUser!.bio).toBe("Test user for findByEmail operation");
      expect(foundUser!.avatarUrl).toBe("https://example.com/avatar.jpg");
      expect(foundUser!.roles).toEqual(["user", "tester"]);
      expect(foundUser!.isActive).toBe(true);
      expect(foundUser!.deletedAt).toBeNull();
    });

    it("should handle case-insensitive email search", async () => {
      // Act - search with different case variations
      const foundUser1 = await userRepository.findByEmail(
        "REPO_TEST_FINDEMAIL@EXAMPLE.COM"
      );
      const foundUser2 = await userRepository.findByEmail(
        "Repo_Test_FindEmail@Example.Com"
      );
      const foundUser3 = await userRepository.findByEmail(
        "repo_test_findemail@EXAMPLE.com"
      );

      // Assert - all should find the same user
      expect(foundUser1).toBeDefined();
      expect(foundUser2).toBeDefined();
      expect(foundUser3).toBeDefined();
      expect(foundUser1!.id).toBe(testUser.id);
      expect(foundUser2!.id).toBe(testUser.id);
      expect(foundUser3!.id).toBe(testUser.id);
    });

    it("should return null for non-existent email", async () => {
      // Act
      const foundUser = await userRepository.findByEmail(
        "nonexistent@example.com"
      );

      // Assert
      expect(foundUser).toBeNull();
    });

    it("should return null for invalid email format", async () => {
      // Act
      const foundUser1 = await userRepository.findByEmail("invalid-email");
      const foundUser2 = await userRepository.findByEmail("@example.com");
      const foundUser3 = await userRepository.findByEmail("test@");

      // Assert
      expect(foundUser1).toBeNull();
      expect(foundUser2).toBeNull();
      expect(foundUser3).toBeNull();
    });

    it("should return null for inactive users", async () => {
      // Arrange - create inactive user
      const inactiveUserData: CreateUserData = {
        email: "repo_test_inactive@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_inactive_user",
        displayName: "Inactive User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: false, // Inactive user
      };

      await userRepository.create(inactiveUserData);

      // Act
      const foundUser = await userRepository.findByEmail(
        "repo_test_inactive@example.com"
      );

      // Assert
      expect(foundUser).toBeNull();
    });

    it("should return null for deleted users", async () => {
      // Arrange - create deleted user
      const deletedUserData: CreateUserData = {
        email: "repo_test_deleted@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_deleted_user",
        displayName: "Deleted User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: new Date(), // Deleted user
        roles: ["user"],
        isActive: true,
      };

      await userRepository.create(deletedUserData);

      // Act
      const foundUser = await userRepository.findByEmail(
        "repo_test_deleted@example.com"
      );

      // Assert
      expect(foundUser).toBeNull();
    });

    it("should handle empty email gracefully", async () => {
      // Act
      const foundUser1 = await userRepository.findByEmail("");
      const foundUser2 = await userRepository.findByEmail(" ");

      // Assert
      expect(foundUser1).toBeNull();
      expect(foundUser2).toBeNull();
    });

    it("should handle special characters in email", async () => {
      // Arrange - create user with special characters in email
      const specialEmailData: CreateUserData = {
        email: "repo_test+special.email-123@example.co.uk",
        passwordHash: "hashedpassword123",
        username: "repo_test_special_user",
        displayName: "Special Email User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const specialUser = await userRepository.create(specialEmailData);

      // Act
      const foundUser = await userRepository.findByEmail(
        "repo_test+special.email-123@example.co.uk"
      );

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(specialUser.id);
      expect(foundUser!.email).toBe(
        "repo_test+special.email-123@example.co.uk"
      );
    });
  });

  describe("findByIds", () => {
    it("should return multiple users by their IDs", async () => {
      // Arrange - create test users
      const user1Data: CreateUserData = {
        email: "repo_test_batch1@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_batch_user1",
        displayName: "Batch User 1",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const user2Data: CreateUserData = {
        email: "repo_test_batch2@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_batch_user2",
        displayName: "Batch User 2",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const user3Data: CreateUserData = {
        email: "repo_test_batch3@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_batch_user3",
        displayName: "Batch User 3",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const user1 = await userRepository.create(user1Data);
      const user2 = await userRepository.create(user2Data);
      const user3 = await userRepository.create(user3Data);

      // Act
      const users = await userRepository.findByIds([
        user1.id,
        user2.id,
        user3.id,
      ]);

      // Assert
      expect(users).toHaveLength(3);
      const userIds = users.map((u) => u.id);
      expect(userIds).toContain(user1.id);
      expect(userIds).toContain(user2.id);
      expect(userIds).toContain(user3.id);
    });

    it("should return empty array when no user IDs provided", async () => {
      // Act
      const users = await userRepository.findByIds([]);

      // Assert
      expect(users).toEqual([]);
    });

    it("should exclude inactive users", async () => {
      // Arrange - create active and inactive users
      const activeUserData: CreateUserData = {
        email: "repo_test_active_batch@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_active_batch",
        displayName: "Active Batch User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const inactiveUserData: CreateUserData = {
        email: "repo_test_inactive_batch@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_inactive_batch",
        displayName: "Inactive Batch User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: false,
      };

      const activeUser = await userRepository.create(activeUserData);
      const inactiveUser = await userRepository.create(inactiveUserData);

      // Act
      const users = await userRepository.findByIds([
        activeUser.id,
        inactiveUser.id,
      ]);

      // Assert
      expect(users).toHaveLength(1);
      expect(users[0]!.id).toBe(activeUser.id);
      expect(users[0]!.isActive).toBe(true);
    });

    it("should exclude deleted users", async () => {
      // Arrange - create non-deleted and deleted users
      const normalUserData: CreateUserData = {
        email: "repo_test_normal_batch@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_normal_batch",
        displayName: "Normal Batch User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const deletedUserData: CreateUserData = {
        email: "repo_test_deleted_batch@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_deleted_batch",
        displayName: "Deleted Batch User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: new Date(),
        roles: ["user"],
        isActive: true,
      };

      const normalUser = await userRepository.create(normalUserData);
      const deletedUser = await userRepository.create(deletedUserData);

      // Act
      const users = await userRepository.findByIds([
        normalUser.id,
        deletedUser.id,
      ]);

      // Assert
      expect(users).toHaveLength(1);
      expect(users[0]!.id).toBe(normalUser.id);
      expect(users[0]!.deletedAt).toBeNull();
    });

    it("should handle mix of existing and non-existing IDs", async () => {
      // Arrange
      const userData: CreateUserData = {
        email: "repo_test_existing_batch@example.com",
        passwordHash: "hashedpassword123",
        username: "repo_test_existing_batch",
        displayName: "Existing Batch User",
        bio: null,
        avatarUrl: null,
        lastSeen: null,
        deletedAt: null,
        roles: ["user"],
        isActive: true,
      };

      const existingUser = await userRepository.create(userData);
      const nonExistingId = "00000000-0000-0000-0000-000000000000";

      // Act
      const users = await userRepository.findByIds([
        existingUser.id,
        nonExistingId,
      ]);

      // Assert
      expect(users).toHaveLength(1);
      expect(users[0]!.id).toBe(existingUser.id);
    });
  });
});
