/**
 * Common event metadata structure
 */
export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  traceId?: string;
}

/**
 * Base event payload structure
 */
export interface BaseEventPayload {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  timestamp: string;
  version: string;
  metadata: EventMetadata;
}

/**
 * Event payload structure for channel.deleted events
 */
export interface ChannelDeletedEventPayload extends BaseEventPayload {
  eventType: "channel.deleted";
  aggregateType: "channel";
  data: {
    channelId: string;
    workspaceId: string;
    channelName: string;
    deletedBy: string;
  };
}

/**
 * Event payload structure for workspace.deleted events
 */
export interface WorkspaceDeletedEventPayload extends BaseEventPayload {
  eventType: "workspace.deleted";
  aggregateType: "workspace";
  data: {
    workspaceId: string;
    workspaceName: string;
    deletedBy: string;
    channelIds: string[];
  };
}
