import winston from "winston";
import { config } from "./env";

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: config.service.name },
  transports: [
    new winston.transports.Console({
      format: config.nodeEnv === "production" ? logFormat : consoleFormat,
    }),
  ],
});

// Create stream for HTTP request logging (Morgan compatibility)
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
