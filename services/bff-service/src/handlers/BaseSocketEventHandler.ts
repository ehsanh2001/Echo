import { Server as SocketIOServer } from "socket.io";
import { ISocketEventHandler } from "../interfaces/handlers";

/**
 * Base class for socket event handlers
 * Provides common Socket.IO server management
 */
export abstract class BaseSocketEventHandler implements ISocketEventHandler {
  protected io: SocketIOServer | null = null;

  /**
   * Set the Socket.IO server instance
   * Must be called before handling any events
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Get the Socket.IO server instance
   * Throws if not initialized
   */
  protected getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error(
        "Socket.IO server not initialized. Call setSocketServer first."
      );
    }
    return this.io;
  }
}
