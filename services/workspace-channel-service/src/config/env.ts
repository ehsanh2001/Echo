import dotenv from "dotenv";
import path from "path";
import { WorkspaceRole } from "@prisma/client";

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
 * const port = getOptionalEnv("PORT", "8002");
 * ```
 */
const getOptionalEnv = (key: string, defaultValue: string): string => {
  const value = process.env[key];
  if (!value) {
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
  port: parseInt(getOptionalEnv("PORT", "8002")),
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),

  // Database Configuration
  database: {
    url: getDatabaseUrl(),
  },

  // JWT Configuration (for token verification)
  jwt: {
    secret: getRequiredEnv("JWT_SECRET"),
  },

  // Service Configuration
  service: {
    name: getOptionalEnv("SERVICE_NAME", "workspace-channel-service"),
    userServiceUrl: getOptionalEnv("USER_SERVICE_URL", "http://localhost:8001"),
  },

  // Frontend Configuration
  frontend: {
    baseUrl: getRequiredEnv("FRONTEND_BASE_URL"),
  },

  // RabbitMQ Configuration
  rabbitmq: {
    url: getRequiredEnv("RABBITMQ_URL"),
    exchange: getOptionalEnv("RABBITMQ_EXCHANGE", "echo.events"),
  },

  // Invite Configuration & Business Rules
  invites: {
    // Configurable via environment (with sensible defaults)
    defaultExpirationDays: parseInt(
      getOptionalEnv("INVITE_DEFAULT_EXPIRATION_DAYS", "7")
    ),

    // Business rules (constants - rarely change)
    maxExpirationDays: 30,
    minExpirationDays: 1,
    defaultRole: WorkspaceRole.member,
    maxCustomMessageLength: 500,
    tokenLength: 64,
  },

  // Outbox Configuration
  outbox: {
    // Configurable via environment (with sensible defaults)
    maxBatchSize: parseInt(getOptionalEnv("OUTBOX_MAX_BATCH_SIZE", "50")),
    maxRetryAttempts: parseInt(
      getOptionalEnv("OUTBOX_MAX_RETRY_ATTEMPTS", "3")
    ),
    retryDelayMs: parseInt(getOptionalEnv("OUTBOX_RETRY_DELAY_MS", "5000")), // 5 seconds
    cleanupIntervalMs: parseInt(
      getOptionalEnv("OUTBOX_CLEANUP_INTERVAL_MS", "3600000")
    ), // 1 hour
    cleanupRetentionDays: parseInt(
      getOptionalEnv("OUTBOX_CLEANUP_RETENTION_DAYS", "7")
    ), // Keep published events for 7 days
  },

  // Worker Configuration (Constants - prevent environment variable explosion)
  worker: {
    // Outbox publisher polling interval in milliseconds (5 seconds)
    pollIntervalMs: 5000,
    // Batch size for processing events (use outbox.maxBatchSize)
    batchSize: 50,
    // Maximum retry attempts before marking as failed (use outbox.maxRetryAttempts)
    maxRetries: 3,
    // Delay between retries in milliseconds (use outbox.retryDelayMs)
    retryDelayMs: 5000,
    // Graceful shutdown timeout in milliseconds (30 seconds)
    shutdownTimeoutMs: 30000,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(getOptionalEnv("RATE_LIMIT_WINDOW", "900000")), // 15 minutes
    max: parseInt(getOptionalEnv("RATE_LIMIT_MAX", "1000")),
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

  // Production JWT security validation
  if (config.nodeEnv === "production") {
    // Check for default/weak JWT secret
    if (
      config.jwt.secret ===
        "your-super-secure-jwt-secret-key-change-this-in-production" ||
      config.jwt.secret ===
        "your-super-secure-jwt-secret-key-change-this-in-production-make-it-at-least-32-chars"
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

  // Port validation
  if (config.port < 1000 || config.port > 65535) {
    errors.push("PORT must be between 1000 and 65535");
  }

  // Service URL validation
  try {
    new URL(config.service.userServiceUrl);
  } catch {
    errors.push("USER_SERVICE_URL must be a valid URL");
  }

  // Frontend URL validation
  try {
    new URL(config.frontend.baseUrl);
  } catch {
    errors.push("FRONTEND_BASE_URL must be a valid URL");
  }

  // RabbitMQ URL validation
  if (
    !config.rabbitmq.url.startsWith("amqp://") &&
    !config.rabbitmq.url.startsWith("amqps://")
  ) {
    errors.push("RABBITMQ_URL must start with amqp:// or amqps://");
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new Error(
      `❌ Configuration validation failed:\n${errors
        .map((err) => `  • ${err}`)
        .join("\n")}`
    );
  }

  // Log successful configuration
  console.log(
    `Config loaded - Environment: ${config.nodeEnv}, Port: ${config.port}`
  );
  console.log(
    `Security: JWT secret length: ${config.jwt.secret.length} characters.`
  );
  console.log(`Service: ${config.service.name}`);
  console.log(`User Service URL: ${config.service.userServiceUrl}`);

  // Parse and display database connection details (safely, without credentials)
  const dbUrl = new URL(config.database.url);
  console.log(
    `Database: ${dbUrl.protocol}//${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`
  );

  // Parse and display RabbitMQ connection details (safely, without credentials)
  try {
    const rabbitUrl = new URL(config.rabbitmq.url);
    console.log(
      `RabbitMQ: ${rabbitUrl.protocol}//${rabbitUrl.hostname}:${
        rabbitUrl.port || 5672
      }`
    );
    console.log(`RabbitMQ Exchange: ${config.rabbitmq.exchange}`);
  } catch {
    console.log(
      `RabbitMQ: ${config.rabbitmq.url.split("@")[1] || config.rabbitmq.url}`
    );
  }
}

// Automatically validate configuration when this module is loaded
// This ensures configuration errors are caught immediately at startup
validateConfig();
