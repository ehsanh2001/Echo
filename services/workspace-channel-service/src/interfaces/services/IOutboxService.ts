import { OutboxEvent } from "@prisma/client";
import { WorkspaceInviteCreatedEventPayload } from "../../types";

/**
 * Service interface for outbox event operations
 */
export interface IOutboxService {
  /**
   * Create a workspace invite created event
   * This is the main method needed for the workspace invite user story
   * @param payload - The complete event payload data
   * @returns Promise resolving to the created outbox event
   */
  createWorkspaceInviteCreatedEvent(
    payload: WorkspaceInviteCreatedEventPayload
  ): Promise<OutboxEvent>;
}
