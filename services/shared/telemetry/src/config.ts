/**
 * Telemetry configuration
 * Reads from environment variables with sensible defaults
 */

import { TelemetryConfig, TelemetryOptions } from "./types";

/**
 * Get instance ID from various environment sources
 */
function getInstanceId(): string {
  return (
    process.env.HOSTNAME ||
    process.env.POD_NAME ||
    process.env.CONTAINER_ID ||
    `local-${process.pid}`
  );
}

/**
 * Determine default sample ratio based on environment
 */
function getDefaultSampleRatio(): number {
  const env = process.env.NODE_ENV || "development";
  // 100% in development, 20% in production
  return env === "production" ? 0.2 : 1.0;
}

/**
 * Build telemetry configuration from environment and options
 */
export function buildConfig(options: TelemetryOptions = {}): TelemetryConfig {
  const serviceName = options.serviceName || process.env.OTEL_SERVICE_NAME;

  if (!serviceName) {
    throw new Error(
      "Service name is required. Set OTEL_SERVICE_NAME environment variable or pass serviceName option."
    );
  }

  const sampleRatioEnv = process.env.OTEL_SAMPLE_RATIO;
  const sampleRatio =
    options.sampleRatio ??
    (sampleRatioEnv ? parseFloat(sampleRatioEnv) : getDefaultSampleRatio());

  // Validate sample ratio
  if (sampleRatio < 0 || sampleRatio > 1) {
    throw new Error(
      `Invalid sample ratio: ${sampleRatio}. Must be between 0.0 and 1.0`
    );
  }

  return {
    serviceName,
    serviceVersion:
      options.serviceVersion || process.env.npm_package_version || "1.0.0",
    instanceId: getInstanceId(),
    otlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector:4317",
    environment: process.env.NODE_ENV || "development",
    sampleRatio,
    debug: options.debug ?? process.env.OTEL_DEBUG === "true",
  };
}

/**
 * Check if telemetry should be enabled
 */
export function isTelemetryEnabled(): boolean {
  // Disable in test environment
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  // Allow explicit disable via env var
  if (process.env.OTEL_SDK_DISABLED === "true") {
    return false;
  }

  return true;
}
