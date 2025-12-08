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
    // Note: Logger not available here as this runs at module load time
    // Using console for environment variable defaults is acceptable
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
    password: getOptionalEnv("REDIS_PASSWORD", "dev-redis-password"),
    keyPrefix: getOptionalEnv("REDIS_KEY_PREFIX", "BFF_SERVICE:"),
  },

  // RabbitMQ configuration
  rabbitmq: {
    // If RABBITMQ_URL is provided with credentials (e.g., amqp://user:pass@host:port), use it
    // Otherwise, construct URL from separate components
    url: getOptionalEnv(
      "RABBITMQ_URL",
      `amqp://${getOptionalEnv("RABBITMQ_USER", "guest")}:${getOptionalEnv(
        "RABBITMQ_PASSWORD",
        "guest"
      )}@localhost:5672`
    ),
    // All services now use a single topic exchange
    exchange: getOptionalEnv("RABBITMQ_EXCHANGE", "echo.events"),
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
