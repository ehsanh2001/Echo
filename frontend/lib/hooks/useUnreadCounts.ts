/**
 * useUnreadCounts Hook
 *
 * Fetches and manages unread message counts for a workspace.
 * Syncs data from React Query to Zustand store for global access.
 */

"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceUnreadCounts, markChannelAsRead } from "@/lib/api/message";
import { useUnreadStore } from "@/lib/stores/unread-store";
import type {
  ChannelUnreadInfo,
  MarkAsReadRequest,
  WorkspaceUnreadCountsApiResponse,
} from "@/types/message";

/**
 * Query key factory for unread-related queries
 */
export const unreadKeys = {
  all: ["unread"] as const,
  workspace: (workspaceId: string) => [...unreadKeys.all, workspaceId] as const,
};

/**
 * Hook to fetch and sync unread counts for a workspace
 *
 * Fetches unread counts from the API and syncs them to the Zustand store.
 * The store is the source of truth for UI components.
 *
 * @param workspaceId - The workspace ID
 * @param channelIds - Array of channel IDs the user is a member of
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * function WorkspaceProvider({ workspaceId, channelIds }) {
 *   const { isLoading, error } = useUnreadCounts(workspaceId, channelIds);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error />;
 *
 *   return <WorkspaceContent />;
 * }
 * ```
 */
export function useUnreadCounts(
  workspaceId: string | null,
  channelIds: string[],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const setUnreadCounts = useUnreadStore((state) => state.setUnreadCounts);

  const query = useQuery({
    queryKey: unreadKeys.workspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId || channelIds.length === 0) {
        return null;
      }
      return getWorkspaceUnreadCounts(workspaceId, channelIds);
    },
    enabled: enabled && !!workspaceId && channelIds.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: true,
  });

  // Sync query data to Zustand store
  useEffect(() => {
    if (query.data?.success && workspaceId) {
      setUnreadCounts(workspaceId, query.data.data.channels);
    }
  }, [query.data, workspaceId, setUnreadCounts]);

  return query;
}

/**
 * Hook to get unread count for a specific channel from Zustand store
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @returns Unread count for the channel
 *
 * @example
 * ```tsx
 * function ChannelItem({ workspaceId, channelId }) {
 *   const unreadCount = useChannelUnreadCount(workspaceId, channelId);
 *   return <Badge count={unreadCount} />;
 * }
 * ```
 */
export function useChannelUnreadCount(
  workspaceId: string | null,
  channelId: string | null
): number {
  return useUnreadStore((state) =>
    workspaceId && channelId
      ? state.getChannelUnread(workspaceId, channelId)
      : 0
  );
}

/**
 * Hook to get total unread count for a workspace from Zustand store
 *
 * @param workspaceId - The workspace ID
 * @returns Total unread count for the workspace
 *
 * @example
 * ```tsx
 * function WorkspaceItem({ workspaceId }) {
 *   const totalUnread = useWorkspaceUnreadCount(workspaceId);
 *   return <Badge count={totalUnread} />;
 * }
 * ```
 */
export function useWorkspaceUnreadCount(workspaceId: string | null): number {
  return useUnreadStore((state) =>
    workspaceId ? state.getWorkspaceUnread(workspaceId) : 0
  );
}

/**
 * Hook to get the last read message number for a channel
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @returns Last read message number (0 if never read)
 *
 * @example
 * ```tsx
 * function MessageList({ workspaceId, channelId }) {
 *   const lastReadNo = useLastReadMessageNo(workspaceId, channelId);
 *   // Use to show "New messages" separator
 * }
 * ```
 */
export function useLastReadMessageNo(
  workspaceId: string | null,
  channelId: string | null
): number {
  return useUnreadStore((state) =>
    workspaceId && channelId
      ? state.getLastReadMessageNo(workspaceId, channelId)
      : 0
  );
}

/**
 * Hook to mark a channel as read
 *
 * Calls the API and updates both React Query cache and Zustand store.
 *
 * @returns Mutation object with markAsRead function
 *
 * @example
 * ```tsx
 * function ChannelView({ workspaceId, channelId }) {
 *   const { markAsRead, isPending } = useMarkAsRead();
 *
 *   const handleRead = () => {
 *     markAsRead({
 *       workspaceId,
 *       channelId,
 *       messageNo: latestMessage.messageNo,
 *       messageId: latestMessage.id
 *     });
 *   };
 * }
 * ```
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const clearUnread = useUnreadStore((state) => state.clearUnread);

  const mutation = useMutation({
    mutationFn: async ({
      workspaceId,
      channelId,
      messageNo,
      messageId,
    }: {
      workspaceId: string;
      channelId: string;
      messageNo: number;
      messageId?: string;
    }) => {
      const request: MarkAsReadRequest = { messageNo };
      if (messageId) {
        request.messageId = messageId;
      }
      return markChannelAsRead(workspaceId, channelId, request);
    },

    onSuccess: (data, variables) => {
      const { workspaceId, channelId, messageNo } = variables;

      // Update Zustand store immediately
      clearUnread(workspaceId, channelId, messageNo);

      // Invalidate the unread counts query to refetch if needed
      queryClient.invalidateQueries({
        queryKey: unreadKeys.workspace(workspaceId),
      });
    },

    onError: (error, variables) => {
      console.error("Failed to mark channel as read:", error, variables);
    },
  });

  return {
    markAsRead: mutation.mutate,
    markAsReadAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
