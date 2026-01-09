import dotenv from "dotenv";
import path from "path";

/**
 * Load environment variables from multiple sources
 * 1. Load project-level .env first (shared defaults)
 * 2. Load service-level .env (overrides project-level)
 */
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Retrieves a required environment variable
 * @param key - The environment variable key to retrieve
 * @returns The environment variable value
 * @throws Error if the variable is not set
 * @example
 * ```typescript
 * const secret = getRequiredEnv("JWT_SECRET");
 * ```
 */
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`❌ Required environment variable ${key} is not set`);
  }

  return value;
};

/**
 * Retrieves an optional environment variable with a default value
 * @param key - The environment variable key to retrieve
 * @param defaultValue - The default value to use if the variable is not set
 * @returns The environment variable value or the default value
 * @example
 * ```typescript
 * const port = getOptionalEnv("PORT", "3000");
 * ```
 */
const getOptionalEnv = (key: string, defaultValue: string): string => {
  const value = process.env[key];
  if (!value) {
    // Note: Logger not available here as this runs at module load time
    // Using console for environment variable defaults is acceptable
    console.log(
      `ℹ️  Environment variable ${key} not set, using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return value;
};

/**
 * Determines the correct database URL based on the current node environment
 * @returns  In test environment, returns DATABASE_URL_TEST
 *           In other environments, returns DATABASE_URL
 * @throws Error if the required database URL is not set
 * @example
 * ```typescript
 *
 * const dbUrl = getDatabaseUrl();
 * ```
 */
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "test") {
    return getRequiredEnv("DATABASE_URL_TEST");
  }
  return getRequiredEnv("DATABASE_URL");
};

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = getDatabaseUrl();

/**
 * Application configuration object with strict environment variable validation
 * Contains all configuration settings loaded from environment variables
 * @readonly
 */
export const config = {
  // Server Configuration
  port: parseInt(getOptionalEnv("PORT", "8001")),
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),

  // Database Configuration
  database: {
    url: getDatabaseUrl(),
  },

  // Security Configuration
  bcrypt: {
    saltRounds: parseInt(getOptionalEnv("BCRYPT_SALT_ROUNDS", "12")),
  },

  // JWT Configuration
  jwt: {
    secret: getRequiredEnv("JWT_SECRET"),
    accessTokenExpirySeconds: parseInt(
      getOptionalEnv("JWT_ACCESS_TOKEN_EXPIRY_SECONDS", "900")
    ), // 15 minutes
    refreshTokenExpirySeconds: parseInt(
      getOptionalEnv("JWT_REFRESH_TOKEN_EXPIRY_SECONDS", "604800")
    ), // 7 days
  },

  // Redis Configuration
  redis: {
    url: getRequiredEnv("REDIS_URL"),
    password: getRequiredEnv("REDIS_PASSWORD"),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(getOptionalEnv("RATE_LIMIT_WINDOW", "900000")), // 15 minutes
    max: parseInt(getOptionalEnv("RATE_LIMIT_MAX", "100")),
  },

  // Password Reset Configuration
  passwordReset: {
    tokenExpiryMinutes: parseInt(
      getOptionalEnv("PASSWORD_RESET_TOKEN_EXPIRY_MINUTES", "15")
    ),
    requestLimit: parseInt(getOptionalEnv("PASSWORD_RESET_REQUEST_LIMIT", "5")),
    rateLimitWindowMinutes: parseInt(
      getOptionalEnv("PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES", "60")
    ),
  },

  // RabbitMQ Configuration
  rabbitmq: {
    url: getRequiredEnv("RABBITMQ_URL"),
    exchange: getOptionalEnv("RABBITMQ_EXCHANGE", "echo.events"),
  },

  // Frontend Configuration
  frontend: {
    url: getRequiredEnv("FRONTEND_URL"),
  },
} as const;

/**
 * Validates configuration settings beyond basic environment variable existence
 * Performs security and business logic validation that cannot be handled by getRequiredEnv()
 * Note: This function is called automatically when this module is imported (fail-fast principle)
 * @throws Error if any security or business logic validations fail
 * @internal This function is called automatically and should not be called manually
 */
export function validateConfig() {
  const errors: string[] = [];

  // Production-specific Redis security validation
  if (config.nodeEnv === "production") {
    const redisUrl = config.redis.url.toLowerCase();

    // Check for secure connection in production
    if (!redisUrl.startsWith("rediss://")) {
      errors.push("Redis must use secure connection (rediss://) in production");
    }

    // Warn about localhost in production
    if (redisUrl.includes("localhost") || redisUrl.includes("127.0.0.1")) {
      errors.push("Redis should not use localhost in production environment");
    }
  }

  // Production JWT security validation
  if (config.nodeEnv === "production") {
    // Check for default/weak JWT secret
    if (
      config.jwt.secret === "your-super-secret-jwt-key-change-in-production"
    ) {
      errors.push(
        "JWT_SECRET must be changed from default value in production"
      );
    }

    // Check for weak JWT secret length
    if (config.jwt.secret.length < 32) {
      errors.push(
        "JWT_SECRET must be at least 32 characters long in production"
      );
    }
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new Error(
      `❌ Configuration validation failed:\n${errors
        .map((err) => `  • ${err}`)
        .join("\n")}`
    );
  }

  // Note: Logger not available here as this runs at module load time
  // Using console for configuration validation is acceptable
  // Log successful configuration
  console.log(
    `Config loaded - Environment: ${config.nodeEnv}, Port: ${config.port}`
  );
  console.log(
    `Security: JWT secret length: ${config.jwt.secret.length} characters.`
  );
  console.log(`Redis: ${config.redis.url.substring(0, 20)}...`);

  // Parse and display database connection details (safely, without credentials)
  const dbUrl = new URL(config.database.url);
  console.log(
    `Database: ${dbUrl.protocol}//${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`
  );
}

// Automatically validate configuration when this module is loaded
// This ensures configuration errors are caught immediately at startup
validateConfig();
