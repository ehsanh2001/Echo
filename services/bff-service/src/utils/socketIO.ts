import { Server as SocketIOServer } from "socket.io";

/**
 * Socket.IO Singleton Utility
 *
 * Provides global access to the Socket.IO server instance.
 * Used by controllers and services that need to emit events.
 */
let ioInstance: SocketIOServer | null = null;

/**
 * Set the Socket.IO server instance
 * Called once during application initialization
 */
export function setSocketIO(io: SocketIOServer): void {
  ioInstance = io;
}

/**
 * Get the Socket.IO server instance
 * @throws Error if Socket.IO has not been initialized
 */
export function getSocketIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error("Socket.IO server has not been initialized");
  }
  return ioInstance;
}

/**
 * Check if Socket.IO is initialized
 */
export function isSocketIOInitialized(): boolean {
  return ioInstance !== null;
}
