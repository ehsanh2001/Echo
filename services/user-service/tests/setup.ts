import dotenv from "dotenv";
import path from "path";

/**
 * Jest Test Setup
 *
 * This file runs before each test file and configures the test environment.
 * It ensures the correct database URL is used for integration tests.
 */

// Load project-level env first (provides shared defaults)
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

// Load service-level env (overrides project-level)
// Use override: true to ensure service-level values take precedence
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

// Use test database URL for integration tests
if (process.env.NODE_ENV === "test" && process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  console.log("🧪 Using test database:", process.env.DATABASE_URL);
}
