import dotenv from "dotenv";
import path from "path";

// Load environment variables
// 1. Load project-level .env first (shared defaults)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
// 2. Load service-level .env (overrides project-level)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Set DATABASE_URL based on environment (for Prisma)
if (process.env.NODE_ENV === "test") {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    "postgresql://postgres:postgres@localhost:5432/users_db_test";
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/users_db";
}

// Environment configuration with validation and defaults
export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || "8001"),
  nodeEnv: process.env.NODE_ENV || "development",

  // Database Configuration for Prisma
  // Use test database URL in test environment, otherwise use regular database URL
  databaseUrl:
    process.env.NODE_ENV === "test"
      ? process.env.DATABASE_URL_TEST ||
        "postgresql://postgres:postgres@localhost:5432/users_db_test"
      : process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/users_db",
  database: {
    url:
      process.env.NODE_ENV === "test"
        ? process.env.DATABASE_URL_TEST ||
          "postgresql://postgres:postgres@localhost:5432/users_db_test"
        : process.env.DATABASE_URL ||
          "postgresql://postgres:postgres@localhost:5432/users_db",
  },

  // Security Configuration
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12"),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  },
} as const;

// Validation function to ensure required environment variables are present
export function validateConfig() {
  // Check for required DATABASE_URL (or DATABASE_URL_TEST in test environment)
  const dbUrl =
    process.env.NODE_ENV === "test"
      ? process.env.DATABASE_URL_TEST
      : process.env.DATABASE_URL;
  if (!dbUrl) {
    const envVar =
      process.env.NODE_ENV === "test" ? "DATABASE_URL_TEST" : "DATABASE_URL";
    throw new Error(`${envVar} environment variable is required`);
  }

  console.log(
    `📊 Config loaded - Environment: ${config.nodeEnv}, Port: ${config.port}`
  );
}

// Export the configuration
export const env = {
  ...config,
  // Convenient DATABASE_URL property that resolves to the correct URL based on environment
  DATABASE_URL: config.databaseUrl,
};
