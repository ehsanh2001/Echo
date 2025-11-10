"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import {
  performTokenRefresh,
  isTokenExpired,
  hasTokens,
} from "@/lib/utils/tokenRefresh";

/**
 * Authentication guard component props
 */
interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Authentication Guard Component
 *
 * Protects routes by checking for valid authentication before rendering children.
 * Uses the shared token refresh utility for consistency with ApiClient.
 *
 * Features:
 * - Checks for tokens in localStorage on mount
 * - Validates token expiration timestamp
 * - Automatically refreshes expired tokens using utility
 * - Shows full-page loading spinner during auth check
 * - Redirects to login page if not authenticated or refresh fails
 * - Preserves current URL for redirect after login
 *
 * Note: Authentication check runs only once on mount. This component is designed
 * to be placed at the page level, so it runs fresh for each protected route.
 * The ApiClient interceptor handles token refresh during API calls.
 *
 * @example
 * ```typescript
 * // In a protected page component
 * export default function WorkspacesPage() {
 *   return (
 *     <AuthGuard>
 *       <WorkspacesContent />
 *     </AuthGuard>
 *   );
 * }
 * ```
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication status on mount
    const checkAuth = async () => {
      // Check if user has any tokens
      if (!hasTokens()) {
        // No tokens at all, redirect to login
        const currentPath = window.location.pathname + window.location.search;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
        return;
      }

      // Check if access token is expired
      if (isTokenExpired()) {
        // Token is expired, refresh it using shared utility
        try {
          await performTokenRefresh();
          // Token refreshed successfully (localStorage already updated)
          setIsChecking(false);
        } catch (error) {
          // Refresh failed - performTokenRefresh already cleared tokens and redirected
          console.error("Token refresh failed in AuthGuard:", error);
        }
      } else {
        // Token is still valid, allow access
        setIsChecking(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Show loading spinner while checking auth or refreshing token
  if (isChecking) {
    return <FullPageLoading />;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
