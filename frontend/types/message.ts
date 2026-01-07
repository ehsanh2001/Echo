/**
 * Message-related TypeScript types
 * Matches backend types from message-service
 */

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
 * Message response (main message data returned from API)
 * Matches the Message model from backend Prisma schema
 */
export interface MessageResponse {
  id: string;
  workspaceId: string;
  channelId: string;
  messageNo: number;
  userId: string;
  content: string;
  contentType: string;
  isEdited: boolean;
  editCount: number;
  deliveryStatus: string;
  parentMessageId: string | null;
  threadRootId: string | null;
  threadDepth: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Message response with author information
 */
export interface MessageWithAuthorResponse extends MessageResponse {
  author: AuthorInfo;
  clientMessageCorrelationId?: string; // Only present for newly created messages
}

/**
 * Parent message preview for reply feature
 * Used in both composer (showing what's being replied to) and message display (showing parent)
 */
export interface ParentMessagePreview {
  id: string;
  content: string; // May be truncated for display
  authorName: string;
  isReply: boolean; // true if parent also has parentMessageId (nested reply)
  isDeleted?: boolean; // true if parent message was deleted
}

/**
 * Request payload for sending a message
 */
export interface SendMessageRequest {
  content: string;
  clientMessageCorrelationId: string; // Required: client-generated correlation ID
  parentMessageId?: string; // Optional: for reply feature
  threadRootId?: string; // For threading (future)
}

/**
 * API response wrapper for sending a message
 */
export interface SendMessageResponse {
  success: boolean;
  data: MessageWithAuthorResponse;
}

/**
 * Temporary/optimistic message (shown before server confirmation)
 */
export interface OptimisticMessage {
  id: string; // Temporary ID like "optimistic-{correlationId}"
  workspaceId: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: Date;
  isPending: true; // Marker for optimistic messages
  clientMessageCorrelationId: string; // For matching with confirmed message
  author: AuthorInfo;
  error?: boolean; // Marker for failed messages
  retryCount?: number; // Number of retry attempts
}

/**
 * Message send status
 */
export type MessageSendStatus = "sending" | "sent" | "error";

/**
 * Union type for both real and optimistic messages
 */
export type MessageOrOptimistic = MessageWithAuthorResponse | OptimisticMessage;

/**
 * Type guard to check if a message is optimistic
 */
export function isOptimisticMessage(
  message: MessageOrOptimistic
): message is OptimisticMessage {
  return "isPending" in message && message.isPending === true;
}

/**
 * Message delivery status enum
 */
export enum MessageDeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}

/**
 * Message content type enum
 */
export enum MessageContentType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  VIDEO = "video",
  AUDIO = "audio",
}

/**
 * Pagination direction for message history
 */
export enum PaginationDirection {
  BEFORE = "before", // Load older messages
  AFTER = "after", // Load newer messages
}

/**
 * Query parameters for fetching message history
 */
export interface MessageHistoryParams {
  cursor?: number; // Optional messageNo to paginate from
  limit?: number; // Number of messages to fetch (default from backend)
  direction?: PaginationDirection; // Pagination direction (default: BEFORE)
}

/**
 * Message history response with pagination cursors
 */
export interface MessageHistoryResponse {
  messages: MessageWithAuthorResponse[];
  nextCursor: number | null; // Cursor for loading newer messages
  prevCursor: number | null; // Cursor for loading older messages
}

/**
 * API response wrapper for message history
 */
export interface GetMessageHistoryResponse {
  success: boolean;
  data: MessageHistoryResponse;
}

/**
 * API response wrapper for getting a single message by ID
 */
export interface GetMessageByIdResponse {
  success: boolean;
  data: MessageWithAuthorResponse;
}

// ===== READ RECEIPT TYPES =====

/**
 * Read receipt response structure
 * Tracks the last message a user has read in a channel
 */
export interface ReadReceiptResponse {
  workspaceId: string;
  channelId: string;
  userId: string;
  lastReadMessageNo: number;
  lastReadMessageId: string | null;
  lastReadAt: string; // ISO-8601
}

/**
 * Channel unread info for a single channel
 */
export interface ChannelUnreadInfo {
  channelId: string;
  unreadCount: number;
  lastMessageNo: number;
  lastReadMessageNo: number;
}

/**
 * Workspace unread counts response
 */
export interface WorkspaceUnreadCountsResponse {
  workspaceId: string;
  channels: ChannelUnreadInfo[];
  totalUnread: number;
}

/**
 * Request body for marking messages as read
 */
export interface MarkAsReadRequest {
  messageNo: number;
  messageId?: string;
}

/**
 * API response wrapper for read receipt operations
 */
export interface ReadReceiptApiResponse {
  success: boolean;
  data: ReadReceiptResponse;
  message: string;
  timestamp: string;
}

/**
 * API response wrapper for workspace unread counts
 */
export interface WorkspaceUnreadCountsApiResponse {
  success: boolean;
  data: WorkspaceUnreadCountsResponse;
  message: string;
  timestamp: string;
}
