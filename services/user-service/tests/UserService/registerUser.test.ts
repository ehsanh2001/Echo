import { UserService } from "../../src/services/userService";
import { UserServiceError } from "../../src/types/error.types";
import { prisma } from "../../src/config/prisma";
import bcrypt from "bcryptjs";

describe("UserService.registerUser", () => {
  beforeEach(async () => {
    // Clean up all test data - delete all users to ensure clean test state
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should successfully register a new user", async () => {
    const userData = {
      email: "test@example.com",
      username: "testuser",
      password: "testpassword123",
      bio: "Test bio",
    };

    const result = await UserService.registerUser(userData);

    expect(result).toMatchObject({
      email: userData.email,
      username: userData.username,
      bio: userData.bio,
      roles: ["user"],
    });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.lastSeen).toBeDefined();

    // Verify user was created in database
    const dbUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });
    expect(dbUser).toBeTruthy();
    expect(dbUser?.email).toBe(userData.email);
    expect(dbUser?.username).toBe(userData.username);
    expect(dbUser?.displayName).toBe(userData.username);

    // Verify password was hashed
    const isValidPassword = await bcrypt.compare(
      userData.password,
      dbUser?.passwordHash || ""
    );
    expect(isValidPassword).toBe(true);
  });

  it("should register user without bio (optional field)", async () => {
    const userData = {
      email: "test2@example.com",
      username: "testuser2",
      password: "testpassword123",
    };

    const result = await UserService.registerUser(userData);

    expect(result).toMatchObject({
      email: userData.email,
      username: userData.username,
      bio: null,
      roles: ["user"],
    });
  });

  it("should throw error when email already exists", async () => {
    const userData = {
      email: "duplicate@example.com",
      username: "user1",
      password: "password123",
    };

    // Create first user
    await UserService.registerUser(userData);

    // Try to create second user with same email
    const duplicateData = {
      email: "duplicate@example.com", // Same email
      username: "user2", // Different username
      password: "password123",
    };

    await expect(UserService.registerUser(duplicateData)).rejects.toThrow(
      UserServiceError
    );

    await expect(UserService.registerUser(duplicateData)).rejects.toThrow(
      "Email already exists"
    );

    // Verify error code and status
    try {
      await UserService.registerUser(duplicateData);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("EMAIL_EXISTS");
      expect((error as UserServiceError).statusCode).toBe(400);
    }
  });

  it("should throw error when username already exists", async () => {
    const userData = {
      email: "user1@example.com",
      username: "duplicateuser",
      password: "password123",
    };

    // Create first user
    await UserService.registerUser(userData);

    // Try to create second user with same username
    const duplicateData = {
      email: "user2@example.com", // Different email
      username: "duplicateuser", // Same username
      password: "password123",
    };

    await expect(UserService.registerUser(duplicateData)).rejects.toThrow(
      UserServiceError
    );

    await expect(UserService.registerUser(duplicateData)).rejects.toThrow(
      "Username already exists"
    );

    // Verify error code and status
    try {
      await UserService.registerUser(duplicateData);
    } catch (error) {
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).code).toBe("USERNAME_EXISTS");
      expect((error as UserServiceError).statusCode).toBe(400);
    }
  });
});
