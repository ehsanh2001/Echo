/**
 * HTTP Client Types
 */

import { AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * HTTP client configuration options
 */
export interface HttpClientConfig {
  /**
   * Service name for logging purposes
   */
  serviceName: string;

  /**
   * Base timeout for requests in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts for failed requests
   * @default 3
   */
  maxRetries?: number;

  /**
   * Enable debug logging for correlation propagation
   * @default false
   */
  debugLogging?: boolean;
}

/**
 * HTTP request options
 * Extends Axios request config
 */
export interface HttpRequestOptions extends AxiosRequestConfig {
  /**
   * Override correlation ID for this specific request
   * If not provided, uses the current request context correlation ID
   */
  correlationId?: string;

  /**
   * Skip retry logic for this request
   * @default false
   */
  skipRetry?: boolean;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * HTTP error details
 */
export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  code?: string;
  response?: AxiosResponse;
  isAxiosError: boolean;
}
