import { prisma } from "../src/config/prisma";
import { env } from "../src/config/env";
import { beforeAll, afterAll, beforeEach } from "@jest/globals";

beforeAll(async () => {
  // Ensure we're in test environment
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Tests must run in test environment! Set NODE_ENV=test");
  }

  // Verify we're using test database for safety
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl.toLowerCase().includes("test")) {
    throw new Error(
      `Test database URL must contain 'test' in the name for safety! Current URL: ${dbUrl}`
    );
  }

  console.log(`✅ Test environment configured with test database: ${dbUrl}`);

  // Connect to the database and run migrations
  await prisma.$connect();
  console.log("�� Connected to test database");
});

beforeEach(async () => {
  // Clean up test data before each test
  // Delete in order of dependencies (most dependent first)
  await prisma.user.deleteMany({});
  console.log("��� Test database cleaned for new test");
});

afterAll(async () => {
  // Clean up and disconnect
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
  console.log("��� Test database disconnected");
});
