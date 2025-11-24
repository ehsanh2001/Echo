"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerUser, loginUser, logoutUser } from "@/lib/api/auth";
import {
  RegisterData,
  LoginData,
  RegisterResponse,
  LoginResponse,
  LogoutResponse,
} from "@/types/auth";
import { useUserStore } from "@/lib/stores/user-store";
import { disconnectSocket } from "@/lib/socket/socketClient";

/**
 * React Query mutation hook for user registration
 *
 * Handles user registration with automatic error handling and logging.
 * Note: Registration does not store tokens - users must log in separately.
 *
 * @returns Mutation object with mutate, mutateAsync, isLoading, isError, etc.
 *
 * @example
 * ```typescript
 * function RegisterForm() {
 *   const registerMutation = useRegister();
 *
 *   const handleSubmit = async (data: RegisterData) => {
 *     const result = await registerMutation.mutateAsync(data);
 *     if (result.success) {
 *       // Show success message and redirect to login
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {registerMutation.isLoading && <LoadingSpinner />}
 *       {registerMutation.isError && <ErrorMessage error={registerMutation.error} />}
 *     </form>
 *   );
 * }
 * ```
 */
export function useRegister() {
  return useMutation<RegisterResponse, Error, RegisterData>({
    mutationFn: registerUser,
    onSuccess: (data) => {
      // Registration successful
      console.log("Registration successful:", data);
    },
    onError: (error) => {
      console.error("Registration failed:", error);
    },
  });
}

/**
 * React Query mutation hook for user login
 *
 * Handles user authentication and automatically stores tokens in localStorage
 * with calculated expiration timestamp. Invalidates user and workspace queries
 * to trigger refetch with authenticated state.
 *
 * @returns Mutation object with mutate, mutateAsync, isLoading, isError, etc.
 *
 * @example
 * ```typescript
 * function LoginForm() {
 *   const loginMutation = useLogin();
 *   const router = useRouter();
 *
 *   const handleSubmit = async (data: LoginData) => {
 *     const result = await loginMutation.mutateAsync(data);
 *     if (result.success) {
 *       router.push('/app/workspaces');
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {loginMutation.isPending && <LoadingSpinner />}
 *       {loginMutation.isError && <ErrorMessage />}
 *     </form>
 *   );
 * }
 * ```
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const setUser = useUserStore((state) => state.setUser);

  return useMutation<LoginResponse, Error, LoginData>({
    mutationFn: loginUser,
    onSuccess: (response) => {
      if (response.success && response.data) {
        // Store tokens in localStorage (infrastructure)
        localStorage.setItem("access_token", response.data.access_token);
        localStorage.setItem("refresh_token", response.data.refresh_token);

        // Calculate and store expiration timestamp (current time + expires_in seconds)
        const expirationTimestamp =
          Date.now() + response.data.expires_in * 1000;
        localStorage.setItem(
          "token_expiration",
          expirationTimestamp.toString()
        );

        // Store user profile in Zustand (UI state)
        setUser(response.data.user);

        // Invalidate workspace queries to trigger refetch with authenticated state
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });
}

/**
 * React Query mutation hook for user logout
 *
 * Logs out the current user by calling the logout API, clearing all cached queries
 * and tokens, then redirects to the login page. Handles errors gracefully.
 *
 * @returns Mutation object with mutate, mutateAsync, isLoading, isError, etc.
 *
 * @example
 * ```typescript
 * function LogoutButton() {
 *   const logoutMutation = useLogout();
 *
 *   return (
 *     <button
 *       onClick={() => logoutMutation.mutate()}
 *       disabled={logoutMutation.isPending}
 *     >
 *       {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const clearUser = useUserStore((state) => state.clearUser);

  return useMutation<LogoutResponse, Error, void>({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Disconnect Socket.IO connection
      disconnectSocket();

      // Clear tokens from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("token_expiration");
      }

      // Clear user profile from Zustand
      clearUser();

      // Clear all cached queries
      queryClient.clear();

      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
    onError: (error) => {
      console.error("Logout failed:", error);

      // Disconnect socket even on error
      disconnectSocket();

      // Even if logout fails on server, clear local tokens and user
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("token_expiration");
      }
      clearUser();

      // Clear cache and redirect anyway
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
}
