/**
 * Logger configuration builder
 * Creates Winston format and transports based on environment and config
 */

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { LoggerConfig, LOG_LEVELS, LOG_COLORS } from "./types";

/**
 * Get log level from environment or config
 */
export function getLogLevel(config: LoggerConfig): string {
  // Priority: config.logLevel > process.env.LOG_LEVEL > default based on NODE_ENV
  if (config.logLevel) return config.logLevel;
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/**
 * Check if file logging is enabled
 */
export function isFileLoggingEnabled(config: LoggerConfig): boolean {
  if (config.enableFileLogging !== undefined) return config.enableFileLogging;
  if (process.env.ENABLE_FILE_LOGGING !== undefined) {
    return process.env.ENABLE_FILE_LOGGING === "true";
  }
  return true; // Default: enabled
}

/**
 * Get log directory path
 */
export function getLogDir(config: LoggerConfig): string {
  return config.logDir || process.env.LOG_DIR || "./logs";
}

/**
 * Create Winston format based on environment
 * Production: JSON format for log aggregation
 * Development: Colorized, human-readable format
 */
export function createLogFormat(serviceName: string): winston.Logform.Format {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Production: JSON format with flattened structure
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
  } else {
    // Development: Colorized, human-readable format
    return winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:SSS" }),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const { timestamp, level, message, service, ...meta } = info;
        const metaStr = Object.keys(meta).length
          ? JSON.stringify(meta, null, 2)
          : "";
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    );
  }
}

/**
 * Create Winston transports array
 */
export function createTransports(config: LoggerConfig): winston.transport[] {
  const transports: winston.transport[] = [];

  // Always add console transport
  transports.push(new winston.transports.Console());

  // Add file transports if enabled
  if (isFileLoggingEnabled(config)) {
    const logDir = getLogDir(config);
    const maxSize = config.maxFileSize || "5m"; // 5MB
    const maxFiles = config.maxFiles || "5";

    // Error log file (errors only)
    transports.push(
      new DailyRotateFile({
        filename: `${logDir}/error-%DATE%.log`,
        datePattern: "YYYY-MM-DD",
        level: "error",
        maxSize,
        maxFiles,
        format: winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:SSS" }),
          winston.format.json()
        ),
      })
    );

    // Combined log file (all levels)
    transports.push(
      new DailyRotateFile({
        filename: `${logDir}/combined-%DATE%.log`,
        datePattern: "YYYY-MM-DD",
        maxSize,
        maxFiles,
        format: winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:SSS" }),
          winston.format.json()
        ),
      })
    );
  }

  return transports;
}

/**
 * Initialize Winston colors
 */
export function initializeColors(): void {
  winston.addColors(LOG_COLORS);
}
