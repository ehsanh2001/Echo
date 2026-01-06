import { PrismaClient } from "@prisma/client";
import { injectable, inject } from "tsyringe";
import logger from "../utils/logger";
import { IHealthService } from "../interfaces/services/IHealthService";

/**
 * Health status for individual components
 */
export interface ComponentHealth {
  status: "healthy" | "unhealthy" | "degraded";
  latencyMs?: number;
  error?: string;
  lastChecked: string;
}

/**
 * Overall health check response
 */
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy" | "degraded";
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  components: {
    database?: ComponentHealth;
    rabbitmqPublisher?: ComponentHealth;
    rabbitmqConsumer?: ComponentHealth;
    redis?: ComponentHealth;
  };
  consecutiveFailures?: number;
  maxConsecutiveFailures?: number;
}

/**
 * Configuration for health check retries
 */
interface HealthCheckConfig {
  maxConsecutiveFailures: number;
  checkTimeoutMs: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

/**
 * Health Service
 *
 * Provides comprehensive health checking for all service dependencies.
 * Implements retry with exponential backoff and tracks consecutive failures.
 *
 * Kubernetes integration:
 * - /health/live: Liveness probe - if this fails, container is restarted
 * - /health/ready: Readiness probe - if this fails, traffic is not routed
 *
 * After maxConsecutiveFailures readiness failures, liveness also fails
 * to trigger container restart.
 */
@injectable()
export class HealthService implements IHealthService {
  private consecutiveReadinessFailures = 0;
  private isApplicationLive = true;
  private readonly config: HealthCheckConfig;
  private readonly startTime = Date.now();

  // External health reporters (set by other services)
  private rabbitMQPublisherHealthy = false;
  private rabbitMQConsumerHealthy = false;
  private redisHealthy = false;

  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {
    this.config = {
      maxConsecutiveFailures: 5,
      checkTimeoutMs: 5000,
      backoffBaseMs: 1000,
      backoffMaxMs: 30000,
    };
  }

  /**
   * Set RabbitMQ publisher health status (called by RabbitMQService)
   */
  setRabbitMQPublisherHealth(healthy: boolean): void {
    this.rabbitMQPublisherHealthy = healthy;
  }

  /**
   * Set RabbitMQ consumer health status (called by RabbitMQConsumer)
   */
  setRabbitMQConsumerHealth(healthy: boolean): void {
    this.rabbitMQConsumerHealthy = healthy;
  }

  /**
   * Set Redis health status (called by CacheService)
   */
  setRedisHealth(healthy: boolean): void {
    this.redisHealthy = healthy;
  }

  /**
   * Get current consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveReadinessFailures;
  }

  /**
   * Calculate backoff delay with exponential increase
   */
  private calculateBackoff(attemptNumber: number): number {
    const delay = Math.min(
      this.config.backoffBaseMs * Math.pow(2, attemptNumber),
      this.config.backoffMaxMs
    );
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Execute a health check with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      await this.withTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        this.config.checkTimeoutMs,
        "Database health check"
      );

      return {
        status: "healthy",
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check RabbitMQ publisher health
   */
  private checkRabbitMQPublisher(): ComponentHealth {
    return {
      status: this.rabbitMQPublisherHealthy ? "healthy" : "unhealthy",
      lastChecked: new Date().toISOString(),
      ...(this.rabbitMQPublisherHealthy
        ? {}
        : { error: "RabbitMQ publisher not connected" }),
    };
  }

  /**
   * Check RabbitMQ consumer health
   */
  private checkRabbitMQConsumer(): ComponentHealth {
    return {
      status: this.rabbitMQConsumerHealthy ? "healthy" : "unhealthy",
      lastChecked: new Date().toISOString(),
      ...(this.rabbitMQConsumerHealthy
        ? {}
        : { error: "RabbitMQ consumer not connected" }),
    };
  }

  /**
   * Check Redis health
   */
  private checkRedis(): ComponentHealth {
    return {
      status: this.redisHealthy ? "healthy" : "degraded", // Redis is optional, so degraded not unhealthy
      lastChecked: new Date().toISOString(),
      ...(this.redisHealthy ? {} : { error: "Redis not connected" }),
    };
  }

  /**
   * Liveness check
   *
   * Returns healthy if:
   * - Application process is running
   * - Haven't exceeded max consecutive readiness failures
   *
   * If this fails, Kubernetes will restart the container
   */
  async checkLiveness(
    serviceName: string,
    version: string
  ): Promise<{ response: HealthCheckResponse; statusCode: number }> {
    const response: HealthCheckResponse = {
      status: this.isApplicationLive ? "healthy" : "unhealthy",
      service: serviceName,
      version,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      components: {},
      consecutiveFailures: this.consecutiveReadinessFailures,
      maxConsecutiveFailures: this.config.maxConsecutiveFailures,
    };

    if (!this.isApplicationLive) {
      logger.error("Liveness check failed - max consecutive failures reached", {
        consecutiveFailures: this.consecutiveReadinessFailures,
        maxConsecutiveFailures: this.config.maxConsecutiveFailures,
      });
    }

    return {
      response,
      statusCode: this.isApplicationLive ? 200 : 503,
    };
  }

  /**
   * Readiness check
   *
   * Checks all critical dependencies:
   * - Database (required)
   * - RabbitMQ Publisher (required for sending events)
   * - RabbitMQ Consumer (required for receiving events)
   * - Redis (optional - degraded if unavailable)
   *
   * If this fails, Kubernetes will stop routing traffic to this pod
   */
  async checkReadiness(
    serviceName: string,
    version: string
  ): Promise<{ response: HealthCheckResponse; statusCode: number }> {
    // Check all components
    const [database] = await Promise.all([this.checkDatabase()]);

    const rabbitmqPublisher = this.checkRabbitMQPublisher();
    const rabbitmqConsumer = this.checkRabbitMQConsumer();
    const redis = this.checkRedis();

    // Determine overall status
    // Required: database, rabbitmq publisher, rabbitmq consumer
    // Optional: redis (can be degraded)
    const criticalComponents = [database, rabbitmqPublisher, rabbitmqConsumer];
    const allCriticalHealthy = criticalComponents.every(
      (c) => c.status === "healthy"
    );
    const anyCriticalUnhealthy = criticalComponents.some(
      (c) => c.status === "unhealthy"
    );

    let overallStatus: "healthy" | "unhealthy" | "degraded";
    if (anyCriticalUnhealthy) {
      overallStatus = "unhealthy";
    } else if (redis.status === "degraded" || redis.status === "unhealthy") {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    // Track consecutive failures
    if (overallStatus === "unhealthy") {
      this.consecutiveReadinessFailures++;

      logger.warn("Readiness check failed", {
        consecutiveFailures: this.consecutiveReadinessFailures,
        maxConsecutiveFailures: this.config.maxConsecutiveFailures,
        database: database.status,
        rabbitmqPublisher: rabbitmqPublisher.status,
        rabbitmqConsumer: rabbitmqConsumer.status,
        redis: redis.status,
      });

      // If we've exceeded max failures, mark application as not live
      if (
        this.consecutiveReadinessFailures >= this.config.maxConsecutiveFailures
      ) {
        this.isApplicationLive = false;
        logger.error(
          "Max consecutive readiness failures reached - marking application as not live",
          {
            consecutiveFailures: this.consecutiveReadinessFailures,
            maxConsecutiveFailures: this.config.maxConsecutiveFailures,
          }
        );
      }
    } else {
      // Reset failure count on success
      if (this.consecutiveReadinessFailures > 0) {
        logger.info("Readiness restored - resetting failure count", {
          previousFailures: this.consecutiveReadinessFailures,
        });
      }
      this.consecutiveReadinessFailures = 0;
      this.isApplicationLive = true;
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      service: serviceName,
      version,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      components: {
        database,
        rabbitmqPublisher,
        rabbitmqConsumer,
        redis,
      },
      consecutiveFailures: this.consecutiveReadinessFailures,
      maxConsecutiveFailures: this.config.maxConsecutiveFailures,
    };

    return {
      response,
      statusCode: overallStatus === "unhealthy" ? 503 : 200,
    };
  }

  /**
   * Simple health check (legacy endpoint - combines live + ready)
   */
  async checkHealth(
    serviceName: string,
    version: string
  ): Promise<{ response: HealthCheckResponse; statusCode: number }> {
    return this.checkReadiness(serviceName, version);
  }
}
