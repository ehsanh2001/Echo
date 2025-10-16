import { inject, injectable } from "tsyringe";
import { OutboxEvent } from "@prisma/client";
import { IOutboxService } from "../interfaces/services/IOutboxService";
import { IOutboxRepository } from "../interfaces/repositories/IOutboxRepository";
import {
  WorkspaceInviteCreatedEventPayload,
  CreateOutboxEventData,
  CreateInviteEventData,
} from "../types";
import { randomUUID } from "crypto";

/**
 * OutboxService - Handles creation of outbox events for event-driven architecture
 * The actual sending/publishing of events is handled by a separate service.
 */
@injectable()
export class OutboxService implements IOutboxService {
  constructor(
    @inject("IOutboxRepository")
    private outboxRepository: IOutboxRepository
  ) {}

  /**
   * Create a workspace invite event from raw invite data
   *
   * @param inviteData - Raw invite information
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID (ID of the event that caused this one)
   * @returns Promise resolving to the created outbox event
   * @throws WorkspaceChannelServiceError if creation fails
   */
  async createInviteEvent(
    inviteData: CreateInviteEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent> {
    const payload = this.createEventPayload(
      inviteData,
      correlationId,
      causationId
    );
    return await this.createWorkspaceInviteCreatedEvent(payload);
  }

  /**
   * Internal method to create an outbox event from a complete payload
   * This is a private implementation detail - callers should use createInviteEvent()
   *
   * @param payload - The complete event payload with all invite details
   * @returns Promise resolving to the created outbox event
   * @throws WorkspaceChannelServiceError if creation fails
   */
  private async createWorkspaceInviteCreatedEvent(
    payload: WorkspaceInviteCreatedEventPayload
  ): Promise<OutboxEvent> {
    // Extract workspace ID from the payload
    const workspaceId = payload.data.workspaceId;

    // Prepare the outbox event data
    const eventData: CreateOutboxEventData = {
      workspaceId,
      aggregateType: payload.aggregateType,
      aggregateId: workspaceId,
      eventType: payload.eventType,
      payload: payload, // Store the complete event payload
    };

    // Create the event in the outbox
    // The repository handles database constraints and errors
    return await this.outboxRepository.create(eventData);
  }

  /**
   * Helper method to create a standardized event payload
   * This ensures consistent event structure across the application
   *
   * @param inviteData - Core invite data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID (ID of the event that caused this one)
   * @returns Formatted event payload
   */
  private createEventPayload(
    inviteData: CreateInviteEventData,
    correlationId?: string,
    causationId?: string
  ): WorkspaceInviteCreatedEventPayload {
    const metadata: {
      source: "workspace-channel-service";
      correlationId?: string;
      causationId?: string;
    } = {
      source: "workspace-channel-service",
    };

    if (correlationId) {
      metadata.correlationId = correlationId;
    }
    if (causationId) {
      metadata.causationId = causationId;
    }

    return {
      eventId: randomUUID(),
      eventType: "workspace.invite.created",
      aggregateType: "workspace",
      aggregateId: inviteData.workspaceId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: inviteData,
      metadata,
    };
  }
}
