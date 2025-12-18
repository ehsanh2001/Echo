import { OutboxEvent } from "@prisma/client";
import {
  CreateInviteEventData,
  EnrichedUserInfo,
  WorkspaceRole,
  ChannelRole,
} from "../../types";

/**
 * Input data for creating a workspace member joined event
 */
export interface CreateWorkspaceMemberJoinedEventData {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  role: WorkspaceRole;
  user: EnrichedUserInfo;
  inviteId?: string;
}

/**
 * Input data for creating a channel member joined event
 */
export interface CreateChannelMemberJoinedEventData {
  channelId: string;
  channelName: string;
  workspaceId: string;
  userId: string;
  role: ChannelRole;
  user: EnrichedUserInfo;
}

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

  /**
   * Create a workspace member joined event when a user joins a workspace
   *
   * @param eventData - The workspace member joined data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  createWorkspaceMemberJoinedEvent(
    eventData: CreateWorkspaceMemberJoinedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent>;

  /**
   * Create a channel member joined event when a user joins a channel
   *
   * @param eventData - The channel member joined data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  createChannelMemberJoinedEvent(
    eventData: CreateChannelMemberJoinedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent>;
}
