import { HealthCheckResponse } from "../../services/HealthService";

/**
 * Interface for Health Service
 */
export interface IHealthService {
  /**
   * Set RabbitMQ publisher health status
   */
  setRabbitMQPublisherHealth(healthy: boolean): void;

  /**
   * Set RabbitMQ consumer health status
   */
  setRabbitMQConsumerHealth(healthy: boolean): void;

  /**
   * Set Redis health status
   */
  setRedisHealth(healthy: boolean): void;

  /**
   * Get current consecutive failure count
   */
  getConsecutiveFailures(): number;

  /**
   * Liveness check - if fails, container should be restarted
   */
  checkLiveness(
    serviceName: string,
    version: string
  ): Promise<{ response: HealthCheckResponse; statusCode: number }>;

  /**
   * Readiness check - if fails, traffic should not be routed
   */
  checkReadiness(
    serviceName: string,
    version: string
  ): Promise<{ response: HealthCheckResponse; statusCode: number }>;

  /**
   * Combined health check (legacy)
   */
  checkHealth(
    serviceName: string,
    version: string
  ): Promise<{ response: HealthCheckResponse; statusCode: number }>;
}
