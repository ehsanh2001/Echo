import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from "@jest/globals";
import userService, { UserServiceError } from "../src/services/userService";
import { prisma } from "../src/config/prisma";
import type { CreateUserRequest } from "../src/types";

// Mock bcrypt to control error scenarios
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

const bcrypt = require("bcrypt");

describe("UserService", () => {
  const validUserData: CreateUserRequest = {
    email: "test@example.com",
    username: "testuser",
    password: "password123",
    display_name: "Test User",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue("hashed_password");
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: validUserData.email },
          { email: "different@example.com" },
        ],
      },
    });
  });

  describe("Successful User Creation", () => {
    it("should successfully create a new user with valid data", async () => {
      const result = await userService.createUser(validUserData);

      // Verify the returned user object
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe(validUserData.email);
      expect(result.username).toBe(validUserData.username);
      expect(result.display_name).toBe(validUserData.display_name);
      expect(result.status).toBeDefined();
      expect(result.created_at).toBeDefined();

      // Verify user was actually saved to database
      const savedUser = await prisma.user.findUnique({
        where: { email: validUserData.email },
      });
      expect(savedUser).toBeDefined();
      expect(savedUser?.email).toBe(validUserData.email);
      expect(savedUser?.username).toBe(validUserData.username);
      expect(savedUser?.passwordHash).toBe("hashed_password");
      expect(savedUser?.passwordHash).not.toBe(validUserData.password);
    });

    it("should create users with unique IDs", async () => {
      const user1Data = {
        ...validUserData,
        email: "user1@example.com",
        username: "user1",
      };
      const user2Data = {
        ...validUserData,
        email: "user2@example.com",
        username: "user2",
      };

      const user1 = await userService.createUser(user1Data);
      const user2 = await userService.createUser(user2Data);

      expect(user1.id).toBeDefined();
      expect(user2.id).toBeDefined();
      expect(user1.id).not.toBe(user2.id);

      // Clean up additional test data
      await prisma.user.deleteMany({
        where: {
          OR: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        },
      });
    });
  });

  describe("UserService Error Handling", () => {
    const validUserData: CreateUserRequest = {
      email: "test@example.com",
      username: "testuser",
      password: "password123",
      display_name: "Test User",
    };

    beforeEach(() => {
      jest.clearAllMocks();
      bcrypt.hash.mockResolvedValue("hashed_password");
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.user.deleteMany({
        where: {
          email: validUserData.email,
        },
      });
    });

    describe("Duplicate Email Handling", () => {
      it("should throw EMAIL_EXISTS error for duplicate email", async () => {
        // First, create a user
        await userService.createUser(validUserData);

        // Try to create another user with same email
        const duplicateEmailData = {
          ...validUserData,
          username: "differentuser",
        };

        try {
          await userService.createUser(duplicateEmailData);
          throw new Error("Expected error to be thrown"); // Fail if no error
        } catch (error) {
          expect(error).toBeInstanceOf(UserServiceError);
          expect((error as UserServiceError).code).toBe("EMAIL_EXISTS");
          expect((error as UserServiceError).message).toBe(
            "Email already registered"
          );
        }
      });
    });

    describe("Duplicate Username Handling", () => {
      it("should throw USERNAME_EXISTS error for duplicate username", async () => {
        // First, create a user
        await userService.createUser(validUserData);

        // Try to create another user with same username
        const duplicateUsernameData = {
          ...validUserData,
          email: "different@example.com",
        };

        try {
          await userService.createUser(duplicateUsernameData);
          throw new Error("Expected error to be thrown"); // Fail if no error
        } catch (error) {
          expect(error).toBeInstanceOf(UserServiceError);
          expect((error as UserServiceError).code).toBe("USERNAME_EXISTS");
          expect((error as UserServiceError).message).toBe(
            "Username already taken"
          );
        }
      });
    });

    describe("Password Hashing Error Handling", () => {
      it("should throw PASSWORD_ERROR when bcrypt fails", async () => {
        // Mock bcrypt to throw an error
        bcrypt.hash.mockRejectedValue(
          new Error("bcrypt error: something went wrong")
        );

        try {
          await userService.createUser(validUserData);
          throw new Error("Expected error to be thrown"); // Fail if no error
        } catch (error) {
          expect(error).toBeInstanceOf(UserServiceError);
          expect((error as UserServiceError).code).toBe("PASSWORD_ERROR");
          expect((error as UserServiceError).message).toBe(
            "Password processing failed"
          );
        }
      });
    });

    describe("Database Error Handling", () => {
      it("should throw DATABASE_ERROR for unexpected database errors", async () => {
        // Mock Prisma to throw an unexpected error
        const originalCreate = prisma.user.create;
        jest
          .spyOn(prisma.user, "create")
          .mockRejectedValue(new Error("Database connection failed"));

        try {
          await userService.createUser(validUserData);
          throw new Error("Expected error to be thrown"); // Fail if no error
        } catch (error) {
          expect(error).toBeInstanceOf(UserServiceError);
          expect((error as UserServiceError).code).toBe("DATABASE_ERROR");
          expect((error as UserServiceError).message).toBe(
            "Failed to create user"
          );
        }

        // Restore original method
        prisma.user.create = originalCreate;
      });
    });

    describe("Error Code Types", () => {
      it("should have proper error codes defined", () => {
        const error = new UserServiceError("Test message", "TEST_CODE");
        expect(error.name).toBe("UserServiceError");
        expect(error.code).toBe("TEST_CODE");
        expect(error.message).toBe("Test message");
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
