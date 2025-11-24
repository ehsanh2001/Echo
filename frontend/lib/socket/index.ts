/**
 * Socket.IO Client Module
 * Barrel export for socket-related utilities
 */

export {
  getSocket,
  disconnectSocket,
  isSocketConnected,
  getSocketId,
} from "./socketClient";

export type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketConnectionState,
} from "./types";
