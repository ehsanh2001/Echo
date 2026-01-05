import { OutboxEvent } from "@prisma/client";
import {
  CreateInviteEventData,
  EnrichedUserInfo,
  WorkspaceRole,
  ChannelRole,
  ChannelType,
  ChannelDeletedEventData,
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
 * Member data for channel created event
 */
export interface CreateChannelCreatedMemberData {
  userId: string;
  channelId: string;
  role: ChannelRole;
  joinedAt: Date;
  isActive: boolean;
  user: EnrichedUserInfo;
}

/**
 * Input data for creating a channel created event
 */
export interface CreateChannelCreatedEventData {
  channelId: string;
  workspaceId: string;
  channelName: string;
  channelDisplayName: string | null;
  channelDescription: string | null;
  channelType: ChannelType;
  createdBy: string;
  memberCount: number;
  isPrivate: boolean;
  members: CreateChannelCreatedMemberData[];
  createdAt: Date;
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

  /**
   * Create a channel created event when a new channel is created
   * Includes full member data for efficient frontend cache updates
   *
   * @param eventData - The channel created data with all members
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  createChannelCreatedEvent(
    eventData: CreateChannelCreatedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent>;

  /**
   * Create a channel deleted event when a channel is deleted
   *
   * @param eventData - The channel deleted data
   * @param correlationId - Optional correlation ID for distributed tracing
   * @param causationId - Optional causation ID
   * @returns Promise resolving to the created outbox event
   */
  createChannelDeletedEvent(
    eventData: ChannelDeletedEventData,
    correlationId?: string,
    causationId?: string
  ): Promise<OutboxEvent>;
}
