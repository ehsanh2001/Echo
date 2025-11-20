/**
 * User Store - Zustand store for user profile data
 *
 * Manages the current user's profile information (separate from auth tokens).
 * Auth tokens (JWT) are stored in localStorage for security and API interceptor access.
 * User profile is stored in Zustand for reactive UI updates and easy access.
 *
 * Architecture:
 * - localStorage: JWT tokens (access_token, refresh_token, token_expiration)
 * - Zustand: User profile data (id, username, displayName, avatarUrl, etc.)
 *
 * Benefits:
 * - Reactive updates when profile changes
 * - Type-safe access throughout the app
 * - Easy to extend with profile update actions
 * - Persisted across page refreshes
 * - DevTools support for debugging
 */

import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import type { UserProfile } from "@/types/auth";

/**
 * User store state interface
 */
interface UserStore {
  /**
   * Current user profile (null if not logged in)
   */
  user: UserProfile | null;

  /**
   * Set the current user profile
   * Called after successful login
   */
  setUser: (user: UserProfile | null) => void;

  /**
   * Update specific fields in the user profile
   * Used for profile updates without full re-login
   */
  updateProfile: (updates: Partial<UserProfile>) => void;

  /**
   * Clear the user profile
   * Called on logout
   */
  clearUser: () => void;

  /**
   * Check if user is authenticated
   * Verifies both user profile exists and valid token in localStorage
   */
  isAuthenticated: () => boolean;
}

/**
 * User store hook
 *
 * Manages user profile state with persistence.
 * Automatically syncs to localStorage and survives page refreshes.
 *
 */
export const useUserStore = create<UserStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,

        setUser: (user) => {
          set({ user }, false, "setUser");
        },

        updateProfile: (updates) => {
          set(
            (state) => ({
              user: state.user ? { ...state.user, ...updates } : null,
            }),
            false,
            "updateProfile"
          );
        },

        clearUser: () => {
          set({ user: null }, false, "clearUser");
        },

        isAuthenticated: () => {
          const { user } = get();
          // Check both user profile exists AND valid token in localStorage
          const hasToken =
            typeof window !== "undefined"
              ? !!localStorage.getItem("access_token")
              : false;
          return !!user && hasToken;
        },
      }),
      {
        name: "user-storage", // localStorage key
        storage: createJSONStorage(() => localStorage),
        // Only persist the user profile, not the computed functions
        partialize: (state) => ({ user: state.user }),
      }
    ),
    { name: "UserStore" } // DevTools name
  )
);

/**
 * Selector hook to get current user
 *
 * Convenience hook for the most common use case.
 *
 * @example
 * ```typescript
 * const user = useCurrentUser();
 * if (user) {
 *   console.log(user.displayName);
 * }
 * ```
 */
export const useCurrentUser = () => useUserStore((state) => state.user);

/**
 * Selector hook to check authentication status
 *
 * Checks both user profile and token validity.
 *
 * @example
 * ```typescript
 * const isAuthenticated = useIsAuthenticated();
 * if (!isAuthenticated) {
 *   router.push('/login');
 * }
 * ```
 */
export const useIsAuthenticated = () =>
  useUserStore((state) => state.isAuthenticated());
