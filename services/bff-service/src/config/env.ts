import dotenv from "dotenv";
import path from "path";

// Load project-level .env first (from echo directory)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Load service-level .env (from bff-service directory) - overrides project-level
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Get required environment variable or throw error
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default value
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (!value) {
    console.log(
      `Environment variable ${key} not set, using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return value;
}

export const config = {
  // Server configuration
  port: parseInt(getOptionalEnv("PORT", "8080"), 10),
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),

  // Service identity
  service: {
    name: getOptionalEnv("SERVICE_NAME", "bff-service"),
  },

  // JWT configuration
  jwt: {
    secret: getRequiredEnv("JWT_SECRET"),
  },

  // External services
  externalServices: {
    userService: getOptionalEnv("USER_SERVICE_URL", "http://localhost:8001"),
    workspaceChannelService: getOptionalEnv(
      "WORKSPACE_CHANNEL_SERVICE_URL",
      "http://localhost:8002"
    ),
    messageService: getOptionalEnv(
      "MESSAGE_SERVICE_URL",
      "http://localhost:8003"
    ),
    frontendBaseUrl: getOptionalEnv(
      "FRONTEND_BASE_URL",
      "http://localhost:3000"
    ),
  },

  // Redis configuration
  redis: {
    url: getOptionalEnv("REDIS_URL", "redis://localhost:6379"),
    keyPrefix: getOptionalEnv("REDIS_KEY_PREFIX", "BFF_SERVICE:"),
  },

  // RabbitMQ configuration
  rabbitmq: {
    url: getOptionalEnv("RABBITMQ_URL", "amqp://localhost:5672"),
    user: getOptionalEnv("RABBITMQ_USER", "guest"),
    password: getOptionalEnv("RABBITMQ_PASSWORD", "guest"),
    // BFF consumes from multiple exchanges
    exchanges: {
      message: "message",
      workspaceChannel: "workspace_channel",
      // If BFF starts publishing, use this exchange name
      bff: "bff",
    },
  },

  // Socket.IO configuration
  socketIO: {
    pingTimeout: parseInt(
      getOptionalEnv("SOCKET_IO_PING_TIMEOUT", "60000"),
      10
    ),
    pingInterval: parseInt(
      getOptionalEnv("SOCKET_IO_PING_INTERVAL", "25000"),
      10
    ),
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(getOptionalEnv("RATE_LIMIT_WINDOW_MS", "900000"), 10), // 15 minutes
    max: parseInt(getOptionalEnv("RATE_LIMIT_MAX_REQUESTS", "100"), 10),
  },
} as const;
