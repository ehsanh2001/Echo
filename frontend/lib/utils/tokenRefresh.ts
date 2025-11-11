"use client";

import axios from "axios";
import type { RefreshResponse } from "@/types/auth";

/**
 * Shared token refresh utility
 *
 * This utility provides a centralized token refresh mechanism used by both:
 * - AuthGuard (proactive refresh on mount)
 * - ApiClient axios interceptor (reactive refresh on 401)
 *
 */

/**
 * Refresh the access token using the refresh token
 *
 * Makes a direct axios call (bypassing interceptors) to the refresh endpoint.
 * Updates localStorage with new tokens on success.
 * Clears localStorage and redirects to login on failure.
 *
 * @returns Promise that resolves with the new access token
 * @throws Error if refresh fails or no refresh token is available
 *
 * @example
 * ```typescript
 * try {
 *   const newToken = await performTokenRefresh();
 *   // Token refreshed successfully, new tokens in localStorage
 * } catch (error) {
 *   // Refresh failed, user redirected to login
 * }
 * ```
 */
export async function performTokenRefresh(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Cannot refresh token on server side");
  }

  const refreshTokenValue = localStorage.getItem("refresh_token");
  if (!refreshTokenValue) {
    throw new Error("No refresh token available");
  }

  const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8004";

  try {
    // Make refresh request directly (bypassing interceptors to avoid recursion)
    const response = await axios.post<RefreshResponse>(
      `${baseURL}/api/auth/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshTokenValue}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error("Token refresh failed");
    }

    const { access_token, refresh_token, expires_in } = response.data.data;

    // Update tokens in localStorage
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    const expiration = Date.now() + expires_in * 1000;
    localStorage.setItem("token_expiration", expiration.toString());

    return access_token;
  } catch (error) {
    // Refresh failed, clear tokens
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expiration");

    // Redirect to login page
    window.location.href = "/login";

    throw error;
  }
}

/**
 * Check if the access token is expired
 *
 * @returns true if token is expired or missing, false if still valid
 */
export function isTokenExpired(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const tokenExpiration = localStorage.getItem("token_expiration");
  if (!tokenExpiration) {
    return true;
  }

  const expirationTime = parseInt(tokenExpiration, 10);
  const currentTime = Date.now();

  return currentTime >= expirationTime;
}

/**
 * Check if user has tokens in localStorage
 *
 * @returns true if both access and refresh tokens exist
 */
export function hasTokens(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  return !!(accessToken && refreshToken);
}
