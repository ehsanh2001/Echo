import dotenv from "dotenv";
import path from "path";

/**
 * Load environment variables from multiple sources
 * 1. Load project-level .env first (shared defaults)
 * 2. Load service-level .env (overrides project-level)
 */
const projectEnvPath = path.resolve(__dirname, "../../../../.env");
const serviceEnvPath = path.resolve(__dirname, "../../.env");

// Load project-level .env first (from echo directory)
dotenv.config({ path: projectEnvPath });

// Load service-level .env (from notification-service directory) - overrides project-level
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
      `Environment variable ${key} not set, using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return value;
};

/**
 * Application configuration object with strict environment variable validation
 * Contains all configuration settings loaded from environment variables
 * @readonly
 */
export const config = {
  // Server Configuration
  port: parseInt(getOptionalEnv("PORT", "8004")),
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),

  // Service Configuration
  service: {
    name: getOptionalEnv("SERVICE_NAME", "notification-service"),
    userServiceUrl: getOptionalEnv("USER_SERVICE_URL", "http://localhost:8001"),
  },

  // RabbitMQ Configuration
  rabbitmq: {
    url: getRequiredEnv("RABBITMQ_URL"),
    exchange: getOptionalEnv("RABBITMQ_EXCHANGE", "echo.events"),
    queue: getOptionalEnv("RABBITMQ_QUEUE", "notification_service_queue"),
  },

  // Email Provider Configuration
  email: {
    // Resend (production)
    resendApiKey: getOptionalEnv("RESEND_API_KEY", ""),
    // SMTP (testing with MailHog)
    useSmtp: getOptionalEnv("USE_SMTP", "false") === "true",
    smtpHost: getOptionalEnv("SMTP_HOST", "localhost"),
    smtpPort: parseInt(getOptionalEnv("SMTP_PORT", "1025")),
    smtpSecure: getOptionalEnv("SMTP_SECURE", "false") === "true",
    smtpUser: getOptionalEnv("SMTP_USER", ""),
    smtpPassword: getOptionalEnv("SMTP_PASSWORD", ""),
    // Common settings
    fromAddress: getOptionalEnv("EMAIL_FROM_ADDRESS", "onboarding@resend.dev"),
    fromName: getOptionalEnv("EMAIL_FROM_NAME", "Echo Workspace"),
  },

  // Frontend URL Configuration
  frontend: {
    baseUrl: getRequiredEnv("FRONTEND_BASE_URL"),
  },

  // Logging Configuration
  logging: {
    level: getOptionalEnv("LOG_LEVEL", "info"),
  },
} as const;
