import { injectable } from "tsyringe";
import { IPasswordResetEventHandler } from "../interfaces/handlers";
import { PasswordResetCompletedEvent } from "../types/rabbitmq.types";
import { BaseSocketEventHandler } from "./BaseSocketEventHandler";
import logger from "../utils/logger";

/**
 * Handler for password reset events
 *
 * Critical event that must be delivered reliably.
 * Notifies all active sessions for a user that their password was reset,
 * triggering a logout on all devices.
 */
@injectable()
export class PasswordResetEventHandler
  extends BaseSocketEventHandler
  implements IPasswordResetEventHandler
{
  /**
   * Handle user.password.reset event
   * Emits password:reset event to all user's active sessions
   */
  async handlePasswordReset(event: PasswordResetCompletedEvent): Promise<void> {
    const io = this.getIO();
    const { userId, email } = event.data;

    // User room name - matches the pattern used in socket authentication
    const userRoomName = `user:${userId}`;

    // Get all sockets in the user room
    const socketsInRoom = await io.in(userRoomName).fetchSockets();
    const socketCount = socketsInRoom.length;

    // Emit password:reset event to all user's active sessions
    // Frontend should handle this by logging the user out
    io.to(userRoomName).emit("password:reset", {
      userId,
      message: "Your password has been reset. Please log in again.",
    });

    logger.info("Broadcasted password:reset event to user sessions", {
      userId,
      email,
      room: userRoomName,
      socketCount,
      eventId: event.eventId,
    });
  }
}
