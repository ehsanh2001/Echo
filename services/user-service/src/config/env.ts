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

  // Database Configuration
  database: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    name: process.env.DB_NAME || "users_db",
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    logging: process.env.NODE_ENV === "development",
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
  const required = [
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "DB_NAME",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
  ];

  const missing = required.filter(
    (key) => !process.env[key] && !hasDefault(key)
  );

  if (missing.length > 0) {
    console.warn(
      `⚠️ Missing environment variables (using defaults): ${missing.join(", ")}`
    );
  }

  console.log(
    `📊 Config loaded - Environment: ${config.nodeEnv}, Database: ${config.database.name}, Port: ${config.port}`
  );
}

function hasDefault(key: string): boolean {
  const defaults: Record<string, boolean> = {
    POSTGRES_HOST: true,
    POSTGRES_PORT: true,
    DB_NAME: true,
    POSTGRES_USER: true,
    POSTGRES_PASSWORD: true,
    PORT: true,
    NODE_ENV: true,
    BCRYPT_SALT_ROUNDS: true,
    RATE_LIMIT_WINDOW_MS: true,
    RATE_LIMIT_MAX_REQUESTS: true,
  };
  return defaults[key] || false;
}
