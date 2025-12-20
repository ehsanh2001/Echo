/**
 * useParentMessage Hook
 *
 * React Query hook to fetch a parent message by ID.
 * Used when displaying a reply to show the parent message preview.
 *
 * Features:
 * - Only fetches when parentMessageId is provided
 * - Infinite staleTime (parent messages rarely change)
 * - Automatic caching and deduplication via React Query
 * - Type-safe with full TypeScript support
 *
 * Use Cases:
 * - Message component showing parent preview for replies
 * - Scrolling to parent message from reply
 * - Displaying "Original message deleted" if parent is not found
 */

"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getMessageById } from "@/lib/api/message";
import type {
  MessageWithAuthorResponse,
  GetMessageByIdResponse,
} from "@/types/message";

/**
 * Query key for parent message queries
 * Includes workspace, channel, and message ID for proper cache scoping
 */
const parentMessageKeys = {
  message: (workspaceId: string, channelId: string, messageId: string) =>
    ["parentMessage", workspaceId, channelId, messageId] as const,
};

/**
 * Hook to fetch a parent message by ID
 *
 * @param workspaceId - Workspace UUID
 * @param channelId - Channel UUID
 * @param parentMessageId - Parent message UUID (null/undefined if not a reply)
 *
 * @returns React Query result with parent message data
 *
 * @example
 * ```typescript
 * // In Message component
 * const { data: parentMessage, isLoading, error } = useParentMessage(
 *   message.workspaceId,
 *   message.channelId,
 *   message.parentMessageId
 * );
 *
 * if (parentMessage) {
 *   return (
 *     <ParentMessagePreview
 *       authorName={parentMessage.author.displayName}
 *       content={parentMessage.content}
 *       isReply={!!parentMessage.parentMessageId}
 *       onClick={() => scrollToMessage(parentMessage.id)}
 *     />
 *   );
 * }
 * ```
 */
export function useParentMessage(
  workspaceId: string,
  channelId: string,
  parentMessageId: string | null | undefined
): UseQueryResult<MessageWithAuthorResponse, Error> {
  return useQuery({
    queryKey: parentMessageId
      ? parentMessageKeys.message(workspaceId, channelId, parentMessageId)
      : ["parentMessage", "disabled"],

    queryFn: async (): Promise<MessageWithAuthorResponse> => {
      if (!parentMessageId) {
        throw new Error("Parent message ID is required");
      }

      const response: GetMessageByIdResponse = await getMessageById(
        workspaceId,
        channelId,
        parentMessageId
      );

      return response.data;
    },

    // Only fetch if parentMessageId exists
    enabled: !!parentMessageId && !!workspaceId && !!channelId,

    // Parent messages rarely change (no edits in current implementation)
    // Set to Infinity to avoid refetching
    staleTime: Infinity,

    // Cache parent messages for 10 minutes
    gcTime: 10 * 60 * 1000,

    // Don't retry on 404 (parent might be deleted)
    retry: (failureCount, error: any) => {
      // Don't retry on 404 Not Found errors
      if (error?.response?.status === 404) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
  });
}
