/**
 * Echo HTTP Client
 *
 * Shared HTTP client for inter-service communication with standardized
 * error handling and retry logic.
 *
 * Features:
 * - Automatic trace context propagation via OTel (traceparent header)
 * - Authorization header forwarding
 * - Request/response logging
 * - Retry logic for transient failures
 * - Timeout configuration
 * - Standardized error handling
 *
 * Note: Correlation/trace headers are automatically propagated by OpenTelemetry's
 * HTTP instrumentation. No manual header injection needed.
 *
 * Usage:
 * ```typescript
 * import { createHttpClient } from '@echo/http-client';
 *
 * const httpClient = createHttpClient({
 *   serviceName: 'bff-service',
 *   timeout: 30000,
 *   debugLogging: true
 * });
 *
 * // In a request handler (OTel automatically propagates trace context)
 * const response = await httpClient.get('http://user-service:8001/api/users/123', {
 *   headers: {
 *     Authorization: req.headers.authorization
 *   }
 * });
 * ```
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import {
  HttpClientConfig,
  HttpRequestOptions,
  HttpResponse,
  HttpError,
} from "./types";

/**
 * Create a configured HTTP client instance
 *
 * Note: OTel's HTTP instrumentation automatically adds traceparent headers
 * for distributed tracing. This client focuses on retry logic and error handling.
 *
 * @param config - HTTP client configuration
 * @returns Configured axios instance with interceptors
 */
export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const {
    serviceName,
    timeout = 30000,
    maxRetries = 3,
    debugLogging = false,
  } = config;

  // Create axios instance with default config
  const instance = axios.create({
    timeout,
    headers: {
      "Content-Type": "application/json",
    },
  });

  /**
   * Request interceptor: Debug logging only
   * Note: OTel HTTP instrumentation automatically adds traceparent headers
   */
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (debugLogging) {
        console.debug(`[${serviceName}] HTTP Client: Sending request`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasAuth: !!config.headers.Authorization,
        });
      }

      return config;
    },
    (error: AxiosError) => {
      console.error(`[${serviceName}] HTTP Client: Request error`, {
        error: error.message,
      });
      return Promise.reject(error);
    }
  );

  /**
   * Response interceptor: Log and handle errors
   */
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      if (debugLogging) {
        console.debug(`[${serviceName}] HTTP Client: Response received`, {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      // Log error
      console.error(`[${serviceName}] HTTP Client: Response error`, {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        code: error.code,
      });

      // Enhance error with additional context
      const enhancedError = error as HttpError;
      enhancedError.isAxiosError = true;

      // Check if we should retry
      const shouldRetry = isRetryableError(error);
      const skipRetry = (error.config as any)?.skipRetry === true;
      const retryCount = (error.config as any)?._retryCount || 0;

      if (shouldRetry && !skipRetry && retryCount < maxRetries) {
        // Increment retry count
        (error.config as any)._retryCount = retryCount + 1;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;

        if (debugLogging) {
          console.debug(
            `[${serviceName}] HTTP Client: Retrying request (attempt ${retryCount + 1}/${maxRetries})`,
            {
              method: error.config?.method?.toUpperCase(),
              url: error.config?.url,
              delayMs: delay,
            }
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry the request
        return instance.request(error.config!);
      }

      return Promise.reject(enhancedError);
    }
  );

  return instance;
}

/**
 * Determine if an error is retryable
 *
 * @param error - Axios error
 * @returns True if error should be retried
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (no response)
  if (!error.response) {
    return true;
  }

  // Retry on 5xx server errors (except 501 Not Implemented)
  if (error.response.status >= 500 && error.response.status !== 501) {
    return true;
  }

  // Retry on 429 Too Many Requests
  if (error.response.status === 429) {
    return true;
  }

  // Retry on specific error codes
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return true;
  }

  return false;
}

/**
 * Extract error message from axios error
 *
 * @param error - Any error object
 * @returns Human-readable error message
 */
export function extractErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    // Try to extract error message from response
    if (error.response?.data) {
      const data = error.response.data as any;
      return (
        data.message ||
        data.error?.message ||
        data.error ||
        error.message ||
        "Request failed"
      );
    }
    return error.message || "Request failed";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
