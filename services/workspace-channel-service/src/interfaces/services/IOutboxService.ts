import { OutboxEvent } from "@prisma/client";
import { CreateInviteEventData } from "../../types";

/**
 * Service interface for outbox event operations
 */
export interface IOutboxService {
  /**
   * Create a workspace invite created event from raw invite data
   * This is the main method for the workspace invite user story
   *
   * @param inviteData - The core invite information
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID (ID of the event that caused this one)
   * @returns Promise resolving to the created outbox event
   */
  createInviteEvent(
    inviteData: CreateInviteEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent>;
}
