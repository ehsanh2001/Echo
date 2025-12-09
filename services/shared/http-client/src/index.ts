/**
 * Echo HTTP Client Package
 *
 * Shared HTTP client for inter-service communication with automatic
 * correlation ID propagation.
 *
 * @example
 * ```typescript
 * import { createHttpClient } from '@echo/http-client';
 *
 * const httpClient = createHttpClient({
 *   serviceName: 'bff-service',
 *   timeout: 30000,
 *   debugLogging: process.env.NODE_ENV === 'development'
 * });
 *
 * // Make requests - correlation headers are automatically added
 * const response = await httpClient.get('http://user-service/api/users/123', {
 *   headers: {
 *     Authorization: req.headers.authorization
 *   }
 * });
 * ```
 */

export { createHttpClient, extractErrorMessage } from "./client";
export type {
  HttpClientConfig,
  HttpRequestOptions,
  HttpResponse,
  HttpError,
} from "./types";
