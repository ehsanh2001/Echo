import dotenv from "dotenv";
import path from "path";

/**
 * Load environment variables from multiple sources
 * 1. Load project-level .env first (shared defaults)
 * 2. Load service-level .env (overrides project-level)
 */
const projectEnvPath = path.resolve(__dirname, "../../../../.env");
const serviceEnvPath = path.resolve(__dirname, "../../.env");

console.log("Loading project .env from:", projectEnvPath);
dotenv.config({ path: projectEnvPath });

console.log("Loading service .env from:", serviceEnvPath);
dotenv.config({ path: serviceEnvPath, override: true });

/**
 * Retrieves a required environment variable
 * @param key - The environment variable key to retrieve
 * @returns The environment variable value
 * @throws Error if the variable is not set
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
  port: parseInt(getOptionalEnv("PORT", "8003")),
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
    name: getOptionalEnv("SERVICE_NAME", "message-service"),
    userServiceUrl: getOptionalEnv("USER_SERVICE_URL", "http://localhost:8001"),
    workspaceChannelServiceUrl: getOptionalEnv(
      "WORKSPACE_CHANNEL_SERVICE_URL",
      "http://localhost:8002"
    ),
  },

  // Redis Configuration (with service prefix)
  redis: {
    url: getRequiredEnv("REDIS_URL"),
    password: getOptionalEnv("REDIS_PASSWORD", ""),
    keyPrefix: getOptionalEnv("REDIS_KEY_PREFIX", "msg:"),
  },

  // RabbitMQ Configuration
  rabbitmq: {
    url: getRequiredEnv("RABBITMQ_URL"),
    exchange: getOptionalEnv("RABBITMQ_EXCHANGE", "message"),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(getOptionalEnv("RATE_LIMIT_WINDOW", "900000")), // 15 minutes
    max: parseInt(getOptionalEnv("RATE_LIMIT_MAX", "100")),
  },

  // Message Configuration
  message: {
    maxLength: parseInt(getOptionalEnv("MAX_MESSAGE_LENGTH", "1024")),
    maxAttachmentSize: parseInt(
      getOptionalEnv("MAX_ATTACHMENT_SIZE", "10485760")
    ), // 10MB
    maxThreadDepth: parseInt(getOptionalEnv("MAX_THREAD_DEPTH", "5")),
  },
} as const;
