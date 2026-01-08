"use client";

import { useMemo } from "react";
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
 * Page parameter for pagination (only loading older messages)
 * - undefined: Initial load (backend returns ALL unread or last N messages)
 * - { cursor, direction }: Load older messages
 */
interface PageParam {
  cursor: number;
  direction: PaginationDirection;
}

/**
 * Hook to fetch message history with simplified infinite scroll
 *
 * Simplified pagination approach:
 * - Initial load: Backend returns ALL unread messages OR last N messages
 *   - We always have the latest messages after initial load (no "gap")
 *   - firstUnreadIndex tells us where to show "New messages" separator
 * - Subsequent loads: Only load OLDER messages via fetchPreviousPage
 *
 * Page structure:
 * - fetchPreviousPage prepends older pages to START of array
 * - Result: [oldest_pages..., initial_page] (chronological order)
 * - Each page's messages are in ASC order (oldest to newest)
 *
 * @param workspaceId - Workspace UUID
 * @param channelId - Channel UUID
 * @param options - Query options
 *
 * @returns React Query infinite query result with messages, firstUnreadIndex, and startedFromUnread
 */
export function useMessageHistory(
  workspaceId: string,
  channelId: string,
  options: UseMessageHistoryOptions = {}
) {
  const { limit, enabled = true } = options;

  const query = useInfiniteQuery<
    MessageHistoryResponse,
    Error,
    InfiniteData<MessageHistoryResponse, PageParam | undefined>,
    ReturnType<typeof messageKeys.channel>,
    PageParam | undefined
  >({
    queryKey: messageKeys.channel(workspaceId, channelId),

    queryFn: async ({ pageParam }) => {
      const response = await getMessageHistory(workspaceId, channelId, {
        cursor: pageParam?.cursor,
        limit,
        direction: pageParam?.direction,
      });

      return response.data;
    },

    // Initial page has no cursor - backend returns ALL unread or last N
    initialPageParam: undefined,

    // No getNextPageParam - we always have the latest messages
    // nextCursor from backend is always null
    getNextPageParam: () => undefined,

    // Get cursor for PREVIOUS page (OLDER messages - scroll up)
    // prevCursor points to messages older than current page
    getPreviousPageParam: (firstPage) => {
      if (firstPage.prevCursor === null) {
        return undefined; // No more older messages
      }
      return {
        cursor: firstPage.prevCursor,
        direction: PaginationDirection.BEFORE,
      };
    },

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

  // Extract startedFromUnread from the initial page
  // With simplified approach, initial page is the LAST one in the array
  // (older pages are prepended via fetchPreviousPage)
  const startedFromUnread = useMemo(() => {
    if (!query.data?.pages.length) {
      return false;
    }
    // Initial page is the last one (older pages prepend to start)
    const initialPage = query.data.pages[query.data.pages.length - 1];
    return initialPage.startedFromUnread;
  }, [query.data?.pages]);

  // Extract firstUnreadIndex from the initial page
  // This tells us where to show the "New messages" separator
  const firstUnreadIndex = useMemo(() => {
    if (!query.data?.pages.length) {
      return -1;
    }
    // Initial page is the last one
    const initialPage = query.data.pages[query.data.pages.length - 1];
    return initialPage.firstUnreadIndex;
  }, [query.data?.pages]);

  return {
    ...query,
    startedFromUnread,
    firstUnreadIndex,
  };
}

/**
 * Helper hook to get all messages from infinite query result
 * Flattens pages into chronological order (oldest to newest)
 *
 * With simplified pagination:
 * - fetchPreviousPage (older) prepends to the START of pages array
 * - Pages are in chronological order: [oldest_pages..., initial_page]
 * - Each page contains messages in ASC order (oldest to newest within page)
 * - Simply flatten them without any reversal
 *
 * @param data - InfiniteData from useMessageHistory
 * @returns Flattened array of messages in chronological order
 */
export function useMessageList(
  data: InfiniteData<MessageHistoryResponse, PageParam | undefined> | undefined
): MessageWithAuthorResponse[] {
  return useMemo(() => {
    if (!data || !data.pages.length) {
      return [];
    }

    // Pages are already in chronological order:
    // [oldest_pages..., initial_page]
    // Each page's messages are in ASC order (oldest to newest)
    // Simply flatten them
    return data.pages.flatMap((page) => page.messages);
  }, [data]);
}

/**
 * Helper hook to check if there are more older messages to load
 */
export function useHasMoreOlderMessages(
  hasPreviousPage: boolean | undefined
): boolean {
  return hasPreviousPage ?? false;
}
