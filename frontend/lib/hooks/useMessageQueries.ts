"use client";

import {
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from "@tanstack/react-query";
import { getMessageHistory } from "@/lib/api/message";
import {
  type MessageWithAuthorResponse,
  type MessageHistoryResponse,
  PaginationDirection,
} from "@/types/message";

/**
 * Query key factory for message-related queries
 * Ensures consistent cache key structure across the app
 */
export const messageKeys = {
  all: ["messages"] as const,
  workspace: (workspaceId: string) =>
    [...messageKeys.all, workspaceId] as const,
  channel: (workspaceId: string, channelId: string) =>
    [...messageKeys.workspace(workspaceId), channelId] as const,
};

/**
 * Options for useMessageHistory hook
 */
interface UseMessageHistoryOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch message history with infinite scroll support
 *
 * Fetches messages in reverse chronological order (newest first).
 * Supports loading older messages on scroll with cursor-based pagination.
 *
 * @param workspaceId - Workspace UUID
 * @param channelId - Channel UUID
 * @param options - Query options
 *
 * @returns React Query infinite query result with message pages
 *
 * @example
 * ```typescript
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 *   isLoading,
 * } = useMessageHistory(workspaceId, channelId);
 *
 * // Access all messages (flattened)
 * const allMessages = data?.pages.flatMap(page => page.messages) ?? [];
 *
 * // Load more older messages
 * if (hasNextPage) {
 *   fetchNextPage();
 * }
 * ```
 */
export function useMessageHistory(
  workspaceId: string,
  channelId: string,
  options: UseMessageHistoryOptions = {}
): UseInfiniteQueryResult<
  InfiniteData<MessageHistoryResponse, number | undefined>,
  Error
> {
  const { limit, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: messageKeys.channel(workspaceId, channelId),

    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      const response = await getMessageHistory(workspaceId, channelId, {
        cursor: pageParam,
        limit,
        direction: PaginationDirection.BEFORE, // Always load older messages
      });

      return response.data;
    },

    // Initial page starts with no cursor (fetches latest messages)
    initialPageParam: undefined as number | undefined,

    // Get the cursor for the next page (older messages)
    // prevCursor points to older messages in our pagination semantics
    getNextPageParam: (lastPage) => {
      return lastPage.prevCursor ?? undefined;
    },

    // Since we're paginating backwards in time, there's no "previous page"
    // in the infinite scroll sense (we always start from latest)
    getPreviousPageParam: () => undefined,

    // Enable/disable based on whether we have valid IDs
    enabled: enabled && !!workspaceId && !!channelId,

    // Keep data fresh
    staleTime: 1000 * 60 * 5, // 5 minutes

    // Retain cache for 30 minutes after component unmount
    gcTime: 1000 * 60 * 30,

    // Refetch on window focus to show new messages
    refetchOnWindowFocus: true,

    // Don't retry on error (let user retry manually)
    retry: 1,
  });
}

/**
 * Helper hook to get all messages from infinite query result
 * Flattens pages and reverses order for display (oldest to newest)
 *
 * @param queryResult - Result from useMessageHistory
 * @returns Flattened array of messages in chronological order
 *
 * @example
 * ```typescript
 * const query = useMessageHistory(workspaceId, channelId);
 * const messages = useMessageList(query);
 *
 * // messages[0] is the oldest
 * // messages[messages.length - 1] is the newest
 * ```
 */
export function useMessageList(
  queryResult: UseInfiniteQueryResult<
    InfiniteData<MessageHistoryResponse, number | undefined>,
    Error
  >
): MessageWithAuthorResponse[] {
  if (!queryResult.data) {
    return [];
  }

  // Pages are returned with newest messages first
  // Each page has messages in ASC order (oldest to newest within page)
  // But pages themselves are in DESC order (newest page first)
  // So we need to reverse the pages, not the messages within
  const reversedPages = [...queryResult.data.pages].reverse();
  const messagesInOrder = reversedPages.flatMap((page) => page.messages);

  return messagesInOrder;
}

/**
 * Helper hook to check if there are more messages to load
 *
 * @param queryResult - Result from useMessageHistory
 * @returns Boolean indicating if more messages can be loaded
 */
export function useHasMoreMessages(
  queryResult: UseInfiniteQueryResult<
    InfiniteData<MessageHistoryResponse, number | undefined>,
    Error
  >
): boolean {
  return queryResult.hasNextPage ?? false;
}
