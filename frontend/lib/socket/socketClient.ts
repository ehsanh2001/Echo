/**
 * Socket.IO Client Manager
 * Singleton pattern for managing Socket.IO connection with JWT authentication
 */

import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let eventHandlersRegistered = false;

/**
 * Register global event listeners that should persist across the socket lifecycle
 * These are registered once and automatically re-attached on reconnect
 */
function registerGlobalEventListeners(socket: TypedSocket) {
  if (eventHandlersRegistered) return;

  // Import here to avoid circular dependency
  import("./globalHandlers").then(({ setupGlobalHandlers }) => {
    setupGlobalHandlers(socket);
    eventHandlersRegistered = true;
  });
}

/**
 * Get or create the Socket.IO client instance
 * Automatically includes JWT token from localStorage for authentication
 *
 * @returns Socket.IO client instance
 */
export function getSocket(): TypedSocket {
  if (!socket) {
    const bffUrl = process.env.NEXT_PUBLIC_BFF_URL;

    if (!bffUrl) {
      throw new Error(
        "NEXT_PUBLIC_BFF_URL environment variable is not defined. Please add it to .env.local"
      );
    }

    // Get JWT token from localStorage
    const token = localStorage.getItem("access_token");

    if (!token) {
      console.warn(
        "No access token found in localStorage. Socket connection may fail authentication."
      );
    }

    // Create socket instance with configuration
    socket = io(bffUrl, {
      auth: {
        token,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Connection lifecycle event handlers
    socket.on("connect", () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Connected", {
          id: socket?.id,
          timestamp: new Date().toISOString(),
        });
      }

      // CRITICAL: Re-register all event listeners on reconnect
      // Socket.IO clears handlers on disconnect, so we must re-attach them
      if (socket) {
        registerGlobalEventListeners(socket);
      }
    });

    socket.on("disconnect", (reason) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Disconnected", {
          reason,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("error", (error) => {
      console.error("[Socket] Error", {
        error,
        timestamp: new Date().toISOString(),
      });
    });

    socket.io.on("reconnect", (attempt) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Reconnected", {
          attempt,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Reconnect attempt", {
          attempt,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.io.on("reconnect_error", (error) => {
      console.error("[Socket] Reconnect error", {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.io.on("reconnect_failed", () => {
      console.error("[Socket] Reconnect failed", {
        timestamp: new Date().toISOString(),
      });
    });
  }

  return socket;
}

/**
 * Disconnect and cleanup the Socket.IO client
 * Call this on logout or when socket connection is no longer needed
 */
export function disconnectSocket(): void {
  if (socket) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Socket] Disconnecting", {
        timestamp: new Date().toISOString(),
      });
    }

    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if socket is currently connected
 *
 * @returns true if socket is connected, false otherwise
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Get the socket ID if connected
 *
 * @returns socket ID or null if not connected
 */
export function getSocketId(): string | null {
  return socket?.id ?? null;
}
