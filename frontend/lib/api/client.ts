"use client";

import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { ApiError } from "@/types/api";
import { performTokenRefresh } from "@/lib/utils/tokenRefresh";

/**
 * Track if a token refresh is in progress to prevent multiple simultaneous refresh attempts
 */
let isRefreshing = false;

/**
 * Promise that resolves when the current token refresh completes
 * Used to queue subsequent requests waiting for the refresh
 */
let refreshPromise: Promise<string> | null = null;

/**
 * API Client for making HTTP requests to the backend
 *
 * Provides a centralized way to make authenticated API calls with automatic
 * error handling and response transformation. Uses axios for HTTP requests.
 *
 * @example
 * ```typescript
 * const data = await apiClient.get<User>('/api/users/me');
 * const result = await apiClient.post<CreateResponse>('/api/items', { name: 'Item' });
 * ```
 */
class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8004";

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Setup interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  /**
   * Setup request interceptor to add authentication token
   *
   * Automatically adds Bearer token from localStorage to all requests
   */
  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add auth token if available (for protected routes)
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("access_token");
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup response interceptor to handle errors and automatic token refresh
   *
   * Handles:
   * - 401 errors with automatic token refresh and request retry
   * - Request queuing during token refresh
   * - Error transformation to ApiError format
   */
  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Axios automatically parses JSON, just return the data
        return response;
      },
      async (error: AxiosError) => {
        // Handle 401 errors with token refresh
        if (error.response?.status === 401) {
          return this.handle401Error(error);
        }

        // Transform other errors to ApiError format
        return this.transformToApiError(error);
      }
    );
  }

  /**
   * Handle 401 Unauthorized errors with automatic token refresh
   *
   * All failed requests are queued and processed together after
   * token refresh completes.
   *
   * @param error - The axios error object
   * @returns Promise that resolves when token is refreshed and request is retried
   */
  private async handle401Error(error: AxiosError): Promise<any> {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Don't retry already retried requests
    if (originalRequest._retry) {
      return this.transformToApiError(error);
    }

    // Skip token refresh for auth endpoints
    if (this.isAuthEndpoint(originalRequest.url)) {
      return this.transformToApiError(error);
    }

    // Mark request as retried to avoid infinite loops
    originalRequest._retry = true;

    // If refresh is NOT in progress, start it
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = this.performTokenRefresh();
    }

    // Wait for refresh to complete (whether we started it or someone else did)
    try {
      const newToken = await refreshPromise!;

      // Retry the request with new token (no await - fire and forget for parallelism)
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return this.axiosInstance(originalRequest);
    } catch (refreshError) {
      // Refresh failed, transform to API error
      throw refreshError;
    }
  }

  /**
   * Check if URL is an authentication endpoint that shouldn't trigger refresh
   *
   * @param url - The request URL
   * @returns true if auth endpoint, false otherwise
   */
  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;

    return (
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/register") ||
      url.includes("/api/auth/refresh")
    );
  }

  /**
   * Perform the actual token refresh operation
   *
   * This method delegates to the shared performTokenRefresh utility
   * to ensure consistent refresh behavior across the application.
   *
   * @returns Promise that resolves with the new access token
   * @throws Error if refresh fails
   */
  private async performTokenRefresh(): Promise<string> {
    try {
      // Use shared token refresh utility
      const newToken = await performTokenRefresh();
      return newToken;
    } catch (refreshError) {
      throw refreshError;
    } finally {
      // Reset refresh state
      isRefreshing = false;
      refreshPromise = null;
    }
  }

  /**
   * Transform axios error to ApiError format
   *
   * @param error - The axios error
   * @returns Rejected promise with ApiError
   */
  private transformToApiError(error: AxiosError): Promise<never> {
    const apiError: ApiError = {
      message:
        (error.response?.data as any)?.message ||
        error.message ||
        "An error occurred",
      status: error.response?.status || 500,
      errors: (error.response?.data as any)?.errors,
    };
    return Promise.reject(apiError);
  }

  /**
   * Performs a GET request to the API
   *
   * @template T - The expected response data type
   * @param path - API endpoint path (e.g., '/api/users/me')
   * @param config - Optional axios request config (for query params, headers, etc.)
   * @returns Promise resolving to the response data
   * @throws {ApiError} When the request fails
   *
   * @example
   * ```typescript
   * const user = await apiClient.get<UserProfile>('/api/users/123');
   *
   * // With query parameters
   * const messages = await apiClient.get<MessagesResponse>('/api/messages', {
   *   params: { cursor: 100, limit: 25 }
   * });
   * ```
   */
  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(path, config);
    return response.data;
  }

  /**
   * Performs a POST request to the API
   *
   * @template T - The expected response data type
   * @param path - API endpoint path (e.g., '/api/auth/register')
   * @param data - Request body data (automatically serialized to JSON by axios)
   * @param config - Optional axios request config (for headers, params, etc.)
   * @returns Promise resolving to the response data
   * @throws {ApiError} When the request fails
   *
   * @example
   * ```typescript
   * const result = await apiClient.post<RegisterResponse>('/api/auth/register', {
   *   email: 'user@example.com',
   *   password: 'password123'
   * });
   *
   * // With custom headers
   * const result = await apiClient.post<Response>('/api/data', data, {
   *   headers: { 'X-Custom-Header': 'value' }
   * });
   * ```
   */
  async post<T>(
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.post<T>(path, data, config);
    console.log("API POST response:", response);
    return response.data;
  }

  /**
   * Performs a PUT request to the API
   *
   * @template T - The expected response data type
   * @param path - API endpoint path (e.g., '/api/users/123')
   * @param data - Request body data (automatically serialized to JSON by axios)
   * @param config - Optional axios request config (for headers, params, etc.)
   * @returns Promise resolving to the response data
   * @throws {ApiError} When the request fails
   *
   * @example
   * ```typescript
   * const updated = await apiClient.put<User>('/api/users/123', {
   *   displayName: 'New Name'
   * });
   *
   * // With custom headers
   * const updated = await apiClient.put<User>('/api/users/123', data, {
   *   headers: { 'X-Custom-Header': 'value' }
   * });
   * ```
   */
  async put<T>(
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.put<T>(path, data, config);
    return response.data;
  }

  /**
   * Performs a DELETE request to the API
   *
   * @template T - The expected response data type
   * @param path - API endpoint path (e.g., '/api/users/123')
   * @param config - Optional axios request config (for headers, params, etc.)
   * @returns Promise resolving to the response data
   * @throws {ApiError} When the request fails
   *
   * @example
   * ```typescript
   * await apiClient.delete('/api/users/123');
   *
   * // With query parameters
   * await apiClient.delete('/api/items', {
   *   params: { cascade: true }
   * });
   * ```
   */
  async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(path, config);
    return response.data;
  }
}

/**
 * Singleton instance of the API client
 *
 * Use this instance throughout the application for all API calls.
 *
 * @example
 * ```typescript
 * import { apiClient } from '@/lib/api/client';
 *
 * const data = await apiClient.get('/api/endpoint');
 * ```
 */
export const apiClient = new ApiClient();
