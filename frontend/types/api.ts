// API response types

/**
 * Generic API response wrapper
 *
 * Standard response structure for all API endpoints.
 *
 * @template T - The type of the data payload
 */
export interface ApiResponse<T = any> {
  /** Whether the request was successful */
  success: boolean;
  /** Human-readable message about the result */
  message: string;
  /** Response data payload (present on success) */
  data?: T;
  /** Error message (present on failure) */
  error?: string;
}

/**
 * API error information
 *
 * Thrown when an API request fails.
 */
export interface ApiError {
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  status: number;
  /** Field-specific validation errors (if applicable) */
  errors?: Record<string, string[]>;
}

/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * API client configuration
 *
 * Configuration options for the API client instance.
 */
export interface ApiClientConfig {
  /** Base URL for all API requests */
  baseURL: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Default headers for all requests */
  headers?: Record<string, string>;
}
