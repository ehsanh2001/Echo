"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, ReactNode } from "react";

/**
 * Props for the QueryProvider component
 */
interface QueryProviderProps {
  children: ReactNode;
}

// Global reference to the QueryClient for use outside React components
let globalQueryClient: QueryClient | null = null;

/**
 * Get the global QueryClient instance
 * Used by Socket.IO handlers that run outside React component lifecycle
 */
export function getQueryClient(): QueryClient | null {
  return globalQueryClient;
}

/**
 * React Query provider component
 *
 * Provides React Query context to the entire application with optimized default settings.
 * Includes development tools in development mode for debugging queries.
 *
 * Configuration:
 * - Stale time: 1 minute (data is considered fresh for 1 minute)
 * - GC time: 10 minutes (unused data is garbage collected after 10 minutes)
 * - Retry logic: Doesn't retry on auth errors (401/403), retries up to 3 times for other errors
 * - Mutations: Don't retry by default
 *
 * @param props - Component props
 * @returns Provider component wrapping children with React Query context
 *
 * @example
 * ```typescript
 * // In root layout
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <QueryProvider>
 *           {children}
 *         </QueryProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient instance with optimized defaults
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute - data is fresh for 1 minute
          gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection time
          retry: (failureCount, error: any) => {
            // Don't retry for auth errors - redirect to login instead
            if (error?.status === 401 || error?.status === 403) {
              return false;
            }
            // Retry up to 3 times for other errors (network issues, server errors)
            return failureCount < 3;
          },
        },
        mutations: {
          retry: false, // Don't retry mutations by default - user should retry manually
        },
      },
    });

    // Store global reference
    globalQueryClient = client;

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development mode only */}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
