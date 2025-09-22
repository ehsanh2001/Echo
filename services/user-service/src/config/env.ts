import dotenv from "dotenv";
import path from "path";

// Load environment variables with override pattern
// 1. Load project-level .env first (shared defaults)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
// 2. Load service-level .env (overrides project-level)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Environment configuration with validation and defaults
export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || "8001"),
  nodeEnv: process.env.NODE_ENV || "development",

  // Database Configuration for Prisma
  database: {
    url: process.env.DATABASE_URL!,
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
  // Check for required DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log(
    `📊 Config loaded - Environment: ${config.nodeEnv}, Port: ${config.port}`
  );
}
