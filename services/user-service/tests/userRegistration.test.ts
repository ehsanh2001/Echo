import request from "supertest";
import { describe, it, beforeEach, afterEach, expect } from "@jest/globals";
import app from "../src/index";
import { prisma } from "../src/config/prisma";

describe("User Registration API", () => {
  const baseUserData = {
    email: "test@example.com",
    username: "testuser",
    password: "password123",
    display_name: "Test User",
  };

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: baseUserData.email },
          { email: "test2@example.com" },
          { username: baseUserData.username },
        ],
      },
    });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: baseUserData.email },
          { email: "test2@example.com" },
          { username: baseUserData.username },
        ],
      },
    });
  });

  describe("Successful Registration", () => {
    it("should register user with all fields provided", async () => {
      const response = await request(app)
        .post("/api/users/register")
        .send(baseUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User registered successfully");
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.email).toBe(baseUserData.email);
      expect(response.body.data.username).toBe(baseUserData.username);
      expect(response.body.data.display_name).toBe(baseUserData.display_name);
      expect(response.body.data.status).toBe("OFFLINE");
      expect(response.body.data).not.toHaveProperty("password_hash");
      expect(response.body.data).not.toHaveProperty("password");
    });

    it("should register user with default values when optional fields not provided", async () => {
      const minimalUserData = {
        email: "test2@example.com",
        username: "testuser2",
        password: "password123",
        display_name: "Test User 2",
      };

      const response = await request(app)
        .post("/api/users/register")
        .send(minimalUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(minimalUserData.email);
      expect(response.body.data.username).toBe(minimalUserData.username);
      expect(response.body.data.display_name).toBe(minimalUserData.display_name);
      expect(response.body.data.status).toBe("OFFLINE");
      expect(response.body.data.created_at).toBeDefined();
    });
  });

  describe("HTTP Status Codes and Response Format", () => {
    it("should return 409 for duplicate email", async () => {
      await request(app)
        .post("/api/users/register")
        .send(baseUserData)
        .expect(201);

      const duplicateEmailData = {
        ...baseUserData,
        username: "differentuser",
      };

      const response = await request(app)
        .post("/api/users/register")
        .send(duplicateEmailData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 409 for duplicate username", async () => {
      await request(app)
        .post("/api/users/register")
        .send(baseUserData)
        .expect(201);

      const duplicateUsernameData = {
        ...baseUserData,
        email: "different@example.com",
      };

      const response = await request(app)
        .post("/api/users/register")
        .send(duplicateUsernameData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });

  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.status).toBe("healthy");
      expect(response.body.service).toBe("user-service");
      expect(response.body.timestamp).toBeTruthy();
    });
  });
});
