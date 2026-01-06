import { inject, injectable } from "tsyringe";
import { OutboxEvent } from "@prisma/client";
import { getTraceId, getUserId } from "@echo/telemetry";
import {
  IOutboxService,
  CreateWorkspaceMemberJoinedEventData,
  CreateChannelMemberJoinedEventData,
  CreateChannelCreatedEventData,
} from "../interfaces/services/IOutboxService";
import {
  IOutboxRepository,
  PrismaTransaction,
} from "../interfaces/repositories/IOutboxRepository";
import {
  WorkspaceInviteCreatedEventPayload,
  WorkspaceMemberJoinedEventPayload,
  ChannelMemberJoinedEventPayload,
  ChannelCreatedEventPayload,
  ChannelDeletedEventPayload,
  ChannelDeletedEventData,
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
   * Create a workspace member joined event
   *
   * @param eventData - Workspace member joined data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  async createWorkspaceMemberJoinedEvent(
    eventData: CreateWorkspaceMemberJoinedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent> {
    const payload = this.createWorkspaceMemberJoinedPayload(
      eventData,
      correlationId,
      causationId
    );

    const outboxData: CreateOutboxEventData = {
      workspaceId: eventData.workspaceId,
      aggregateType: payload.aggregateType,
      aggregateId: eventData.workspaceId,
      eventType: payload.eventType,
      payload: payload,
    };

    return await this.outboxRepository.create(outboxData);
  }

  /**
   * Create a channel member joined event
   *
   * @param eventData - Channel member joined data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  async createChannelMemberJoinedEvent(
    eventData: CreateChannelMemberJoinedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent> {
    const payload = this.createChannelMemberJoinedPayload(
      eventData,
      correlationId,
      causationId
    );

    const outboxData: CreateOutboxEventData = {
      workspaceId: eventData.workspaceId,
      channelId: eventData.channelId,
      aggregateType: payload.aggregateType,
      aggregateId: eventData.channelId,
      eventType: payload.eventType,
      payload: payload,
    };

    return await this.outboxRepository.create(outboxData);
  }

  /**
   * Create a channel created event
   *
   * @param eventData - Channel created data with full member information
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  async createChannelCreatedEvent(
    eventData: CreateChannelCreatedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent> {
    const payload = this.createChannelCreatedPayload(
      eventData,
      correlationId,
      causationId
    );

    const outboxData: CreateOutboxEventData = {
      workspaceId: eventData.workspaceId,
      channelId: eventData.channelId,
      aggregateType: payload.aggregateType,
      aggregateId: eventData.channelId,
      eventType: payload.eventType,
      payload: payload,
    };

    return await this.outboxRepository.create(outboxData);
  }

  /**
   * Create a channel deleted event
   *
   * @param eventData - Channel deleted data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @param tx - Optional Prisma transaction context for transactional outbox pattern
   * @returns Promise resolving to the created outbox event
   */
  async createChannelDeletedEvent(
    eventData: ChannelDeletedEventData,
    correlationId?: string,
    causationId?: string,
    tx?: PrismaTransaction
  ): Promise<OutboxEvent> {
    const payload = this.createChannelDeletedPayload(
      eventData,
      correlationId,
      causationId
    );

    const outboxData: CreateOutboxEventData = {
      workspaceId: eventData.workspaceId,
      channelId: eventData.channelId,
      aggregateType: payload.aggregateType,
      aggregateId: eventData.channelId,
      eventType: payload.eventType,
      payload: payload,
    };

    return await this.outboxRepository.create(outboxData, tx);
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
    // Capture trace context from OTel if not explicitly provided
    const effectiveCorrelationId = correlationId ?? getTraceId();
    const userId = getUserId();

    const metadata: {
      source: "workspace-channel-service";
      correlationId?: string;
      causationId?: string;
      userId?: string;
    } = {
      source: "workspace-channel-service",
    };

    if (effectiveCorrelationId) {
      metadata.correlationId = effectiveCorrelationId;
    }
    if (causationId) {
      metadata.causationId = causationId;
    }
    if (userId) {
      metadata.userId = userId;
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

  /**
   * Create metadata object for event payloads
   */
  private createMetadata(correlationId?: string, causationId?: string) {
    const effectiveCorrelationId = correlationId ?? getTraceId();
    const userId = getUserId();

    const metadata: {
      source: "workspace-channel-service";
      correlationId?: string;
      causationId?: string;
      userId?: string;
    } = {
      source: "workspace-channel-service",
    };

    if (effectiveCorrelationId) {
      metadata.correlationId = effectiveCorrelationId;
    }
    if (causationId) {
      metadata.causationId = causationId;
    }
    if (userId) {
      metadata.userId = userId;
    }

    return metadata;
  }

  /**
   * Create workspace member joined event payload
   */
  private createWorkspaceMemberJoinedPayload(
    eventData: CreateWorkspaceMemberJoinedEventData,
    correlationId?: string,
    causationId?: string
  ): WorkspaceMemberJoinedEventPayload {
    return {
      eventId: randomUUID(),
      eventType: "workspace.member.joined",
      aggregateType: "workspace",
      aggregateId: eventData.workspaceId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: eventData,
      metadata: this.createMetadata(correlationId, causationId),
    };
  }

  /**
   * Create channel member joined event payload
   */
  private createChannelMemberJoinedPayload(
    eventData: CreateChannelMemberJoinedEventData,
    correlationId?: string,
    causationId?: string
  ): ChannelMemberJoinedEventPayload {
    return {
      eventId: randomUUID(),
      eventType: "channel.member.joined",
      aggregateType: "channel",
      aggregateId: eventData.channelId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: eventData,
      metadata: this.createMetadata(correlationId, causationId),
    };
  }

  /**
   * Create channel created event payload
   */
  private createChannelCreatedPayload(
    eventData: CreateChannelCreatedEventData,
    correlationId?: string,
    causationId?: string
  ): ChannelCreatedEventPayload {
    return {
      eventId: randomUUID(),
      eventType: "channel.created",
      aggregateType: "channel",
      aggregateId: eventData.channelId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        channelId: eventData.channelId,
        workspaceId: eventData.workspaceId,
        channelName: eventData.channelName,
        channelDisplayName: eventData.channelDisplayName,
        channelDescription: eventData.channelDescription,
        channelType: eventData.channelType,
        createdBy: eventData.createdBy,
        memberCount: eventData.memberCount,
        isPrivate: eventData.isPrivate,
        members: eventData.members.map((m) => ({
          userId: m.userId,
          channelId: m.channelId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          isActive: m.isActive,
          user: m.user,
        })),
        createdAt: eventData.createdAt.toISOString(),
      },
      metadata: this.createMetadata(correlationId, causationId),
    };
  }

  /**
   * Create channel deleted event payload
   */
  private createChannelDeletedPayload(
    eventData: ChannelDeletedEventData,
    correlationId?: string,
    causationId?: string
  ): ChannelDeletedEventPayload {
    return {
      eventId: randomUUID(),
      eventType: "channel.deleted",
      aggregateType: "channel",
      aggregateId: eventData.channelId,
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        channelId: eventData.channelId,
        workspaceId: eventData.workspaceId,
        channelName: eventData.channelName,
        deletedBy: eventData.deletedBy,
      },
      metadata: this.createMetadata(correlationId, causationId),
    };
  }
}
