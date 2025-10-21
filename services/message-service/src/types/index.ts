/**
 * Common types and interfaces for message-service
 */

// ===== JWT & AUTH TYPES =====

/**
 * JWT Token payload structure (must match user-service)
 */
export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

// ===== REQUEST TYPES =====

/**
 * Request to send a message to a channel
 */
export interface CreateMessageRequest {
  content: string;
}

// ===== RESPONSE TYPES =====

/**
 * Message response (main message data returned to client)
 * Matches the Message model from Prisma schema
 */
export interface MessageResponse {
  id: string;
  workspaceId: string;
  channelId: string;
  messageNo: number; // Converted from bigint for JSON serialization
  userId: string;
  content: string;
  contentType: string;
  isEdited: boolean;
  editCount: number;
  deliveryStatus: string;
  parentMessageId: string | null;
  threadRootId: string | null;
  threadDepth: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Author information (minimal user data)
 */
export interface AuthorInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Message response with author info
 */
export interface MessageWithAuthorResponse extends MessageResponse {
  author: AuthorInfo;
}

/**
 * Standard API success response wrapper
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: Record<string, any>;
  };
  timestamp: string;
}

// ===== INTERNAL TYPES =====

/**
 * Data required to create a message in the repository
 * messageNo is automatically generated internally
 */
export interface CreateMessageData {
  workspaceId: string;
  channelId: string;
  userId: string;
  content: string;
  contentType?: string;
  parentMessageId?: string | null;
  threadRootId?: string | null;
  threadDepth?: number;
}

/**
 * Channel details from workspace-channel-service
 */
export interface ChannelDetails {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string | null;
  type: string;
  isArchived: boolean;
  isReadOnly: boolean;
}

/**
 * User information from user-service (cached)
 */
export interface UserInfo {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  lastSeen: Date | null;
  roles: string[];
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Service error details
 */
export interface ServiceErrorDetails {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

// ===== RABBITMQ EVENT TYPES =====

/**
 * Message created event payload for RabbitMQ
 */
export interface MessageCreatedEvent {
  type: "message.created";
  payload: {
    id: string;
    workspaceId: string;
    channelId: string;
    messageNo: number;
    userId: string;
    content: string;
    contentType: string;
    parentMessageId: string | null;
    threadRootId: string | null;
    threadDepth: number;
    createdAt: string; // ISO-8601
  };
  metadata: {
    timestamp: string; // ISO-8601
    service: string;
    version: string;
  };
}

/**
 * Generic message event type
 */
export type MessageEvent = MessageCreatedEvent;
