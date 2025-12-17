"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  initializeFaro,
  getWebInstrumentations,
  FaroErrorBoundary,
  faro,
  LogLevel,
} from "@grafana/faro-react";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

/**
 * Faro configuration for frontend observability
 * Sends logs, errors, traces, and metrics to Grafana Alloy
 *
 * NOTE: Console output is SUPPRESSED in the browser - logs are only sent to Alloy
 * This means console.log() etc will NOT appear in browser DevTools
 */

// Environment configuration
const FARO_COLLECTOR_URL =
  process.env.NEXT_PUBLIC_FARO_COLLECTOR_URL ||
  "http://localhost:12347/collect";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "echo-frontend";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";
const APP_ENVIRONMENT =
  process.env.NEXT_PUBLIC_APP_ENVIRONMENT || "development";

// Flag to track if Faro has been initialized
let faroInitialized = false;

// Store original console methods for potential restoration
let originalConsole: {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
} | null = null;

/**
 * Suppress browser console output while sending logs to Faro
 * Console methods are replaced with Faro log pushes
 */
function suppressConsoleOutput() {
  if (typeof window === "undefined" || originalConsole) {
    return;
  }

  // Save original console methods
  originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  // Helper to convert arguments to string array
  const argsToStrings = (args: unknown[]): string[] => {
    return args.map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    });
  };

  // Replace console methods with Faro log pushes (no browser output)
  console.log = (...args: unknown[]) => {
    if (faroInitialized && faro.api) {
      faro.api.pushLog(argsToStrings(args), { level: LogLevel.INFO });
    }
  };

  console.info = (...args: unknown[]) => {
    if (faroInitialized && faro.api) {
      faro.api.pushLog(argsToStrings(args), { level: LogLevel.INFO });
    }
  };

  console.warn = (...args: unknown[]) => {
    if (faroInitialized && faro.api) {
      faro.api.pushLog(argsToStrings(args), { level: LogLevel.WARN });
    }
  };

  console.error = (...args: unknown[]) => {
    if (faroInitialized && faro.api) {
      faro.api.pushLog(argsToStrings(args), { level: LogLevel.ERROR });
    }
  };

  console.debug = (...args: unknown[]) => {
    if (faroInitialized && faro.api) {
      faro.api.pushLog(argsToStrings(args), { level: LogLevel.DEBUG });
    }
  };
}

/**
 * Initialize Grafana Faro SDK
 * Must only be called once on the client side
 */
function initFaro() {
  if (faroInitialized || typeof window === "undefined") {
    return;
  }

  try {
    initializeFaro({
      url: FARO_COLLECTOR_URL,
      app: {
        name: APP_NAME,
        version: APP_VERSION,
        environment: APP_ENVIRONMENT,
      },

      instrumentations: [
        // Web Vitals, errors, and basic instrumentation
        // captureConsole is disabled - we handle console suppression ourselves
        ...getWebInstrumentations({
          captureConsole: false,
        }),

        // Distributed tracing - propagate trace context to backend
        new TracingInstrumentation({
          instrumentationOptions: {
            // Propagate trace context to these URLs
            propagateTraceHeaderCorsUrls: [
              /http:\/\/localhost:8001.*/, // user-service
              /http:\/\/localhost:8002.*/, // workspace-channel-service
              /http:\/\/localhost:8003.*/, // message-service
              /http:\/\/localhost:8004.*/, // bff-service
              /http:\/\/localhost:8080.*/, // bff-service (alternate)
            ],
          },
        }),

        // Note: ReactIntegration requires react-router-dom which Next.js doesn't use
        // Route changes are tracked via Web Vitals instrumentation instead
      ],

      // Session tracking for user journey analysis
      sessionTracking: {
        enabled: true,
        persistent: true, // Persist session ID across page reloads
      },

      // Batching configuration for performance
      batching: {
        enabled: true,
        sendTimeout: 1000, // Send batch every 1 second
        itemLimit: 50, // Or when 50 items accumulated
      },

      // Don't capture user IP
      ignoreUrls: [],

      // Deduplicate identical errors
      dedupe: true,
    });

    faroInitialized = true;

    // Log initialization success (this goes to Alloy, not browser console)
    faro.api.pushLog(["Faro initialized successfully"], {
      level: LogLevel.INFO,
      context: {
        component: "FaroProvider",
        action: "initialize",
      },
    });
  } catch (error) {
    // If Faro fails to initialize, we still want the app to work
    // Use native console for this error since Faro isn't available
    console.error("Failed to initialize Faro:", error);
  }
}

/**
 * Props for FaroProvider component
 */
interface FaroProviderProps {
  children: ReactNode;
}

/**
 * FaroProvider - Wraps the application with Grafana Faro observability
 *
 * Features:
 * - Automatic error tracking with stack traces
 * - Console log capture (sent to Alloy, not browser console)
 * - Web Vitals (LCP, FID, CLS, TTFB, FCP)
 * - Distributed tracing with backend services
 * - Session tracking for user journey analysis
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * <FaroProvider>
 *   <YourApp />
 * </FaroProvider>
 * ```
 */
export function FaroProvider({ children }: FaroProviderProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    initFaro();
    // Suppress console output AFTER Faro is initialized
    suppressConsoleOutput();
  }, []);

  // During SSR, just render children without Faro
  if (!isClient) {
    return <>{children}</>;
  }

  // Wrap with FaroErrorBoundary for automatic error capture
  return (
    <FaroErrorBoundary
      fallback={(error, resetError) => (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold text-destructive">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={resetError}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </FaroErrorBoundary>
  );
}

/**
 * Hook to push custom events to Faro
 * Use this to track specific user actions
 *
 * @example
 * ```tsx
 * const pushEvent = useFaroEvent();
 * pushEvent('message_sent', { channelId: '123', workspaceId: '456' });
 * ```
 */
export function useFaroEvent() {
  return (name: string, attributes?: Record<string, string>) => {
    if (faroInitialized && faro.api) {
      faro.api.pushEvent(name, attributes);
    }
  };
}

/**
 * Hook to push custom logs to Faro
 * Use this for important logging that should go to observability
 *
 * @example
 * ```tsx
 * const log = useFaroLog();
 * log.info('User logged in', { userId: '123' });
 * log.error('API call failed', { endpoint: '/api/messages' });
 * ```
 */
export function useFaroLog() {
  return {
    debug: (message: string, context?: Record<string, string>) => {
      if (faroInitialized && faro.api) {
        faro.api.pushLog([message], { level: LogLevel.DEBUG, context });
      }
    },
    info: (message: string, context?: Record<string, string>) => {
      if (faroInitialized && faro.api) {
        faro.api.pushLog([message], { level: LogLevel.INFO, context });
      }
    },
    warn: (message: string, context?: Record<string, string>) => {
      if (faroInitialized && faro.api) {
        faro.api.pushLog([message], { level: LogLevel.WARN, context });
      }
    },
    error: (message: string, context?: Record<string, string>) => {
      if (faroInitialized && faro.api) {
        faro.api.pushLog([message], { level: LogLevel.ERROR, context });
      }
    },
  };
}

/**
 * Hook to set user information for session tracking
 * Call this after successful login
 *
 * @example
 * ```tsx
 * const setUser = useFaroUser();
 * setUser({ id: '123', email: 'user@example.com', username: 'johndoe' });
 * ```
 */
export function useFaroUser() {
  return (user: { id: string; email?: string; username?: string } | null) => {
    if (faroInitialized && faro.api) {
      if (user) {
        faro.api.setUser({
          id: user.id,
          email: user.email,
          username: user.username,
        });
      } else {
        faro.api.resetUser();
      }
    }
  };
}
