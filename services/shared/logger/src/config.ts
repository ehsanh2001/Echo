/**
 * Logger configuration builder
 * Creates Winston format and transports for containerized environments
 * Always outputs JSON to stdout/stderr for log aggregation (Loki/Grafana)
 */

import winston from "winston";
import { LoggerConfig } from "./types";

/**
 * Get log level from environment or config
 */
export function getLogLevel(config: LoggerConfig): string {
  // Priority: config.logLevel > process.env.LOG_LEVEL > default
  if (config.logLevel) return config.logLevel;
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/**
 * Create Winston format - always JSON for Grafana/Loki
 */
export function createLogFormat(serviceName: string): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:SSS" }),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      // Add service name to every log entry
      info.service = serviceName;
      return info;
    })(),
    winston.format.json()
  );
}

/**
 * Create Winston transports - console only for containers
 */
export function createTransports(config: LoggerConfig): winston.transport[] {
  // Only console output - logs go to stdout/stderr for aggregation
  return [new winston.transports.Console()];
}
