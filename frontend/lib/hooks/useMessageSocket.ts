/**
 * useMessageSocket Hook
 * Listens to Socket.IO message events and updates React Query cache
 *
 * Handles two types of messages:
 * 1. Own messages (with clientMessageCorrelationId) - replaces optimistic message
 * 2. Messages from other users - adds to cache if channel is loaded
 *
 * Also updates unread counts in Zustand store when messages arrive
 * for channels that are not currently active.
 */

import { useEffect, useCallback } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket/socketClient";
import { messageKeys } from "./useMessageQueries";
import { useUnreadStore } from "@/lib/stores/unread-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type {
  MessageWithAuthorResponse,
  MessageHistoryResponse,
} from "@/types/message";

/**
 * Logs debug information in development mode
 */
function logDev(message: string, data?: any) {
  if (process.env.NODE_ENV === "development") {
    console.log(message, data);
  }
}

/**
 * Attempts to replace an optimistic message with the confirmed message
 * Returns updated pages if successful, null otherwise
 */
function replaceOptimisticMessage(
  pages: MessageHistoryResponse[],
  message: MessageWithAuthorResponse,
  correlationId: string
): MessageHistoryResponse[] | null {
  logDev("[Socket] Attempting to replace optimistic message", {
    correlationId,
  });

  const newPages = [...pages];

  // Search all pages (not just last page) to handle edge cases.
  // If while waiting for user response the React Query loaded more pages then
  // the optimistic message might be on a different page.
  for (let pageIndex = newPages.length - 1; pageIndex >= 0; pageIndex--) {
    const page = newPages[pageIndex];

    // Find optimistic message by correlation ID (must match exactly)
    const messageIndex = page.messages.findIndex(
      (msg) => (msg as any).clientMessageCorrelationId === correlationId
    );

    if (messageIndex !== -1) {
      const updatedMessages = [...page.messages];
      updatedMessages[messageIndex] = message;

      newPages[pageIndex] = {
        ...page,
        messages: updatedMessages,
      };

      logDev("[Socket] Successfully replaced optimistic message", {
        pageIndex,
        messageIndex,
      });
      return newPages;
    }
  }

  logDev("[Socket] No optimistic message found to replace", {
    correlationId,
  });
  return null;
}

/**
 * Checks if a message already exists in the cache
 * Searches all pages to prevent duplicates
 */
function messageExists(
  pages: MessageHistoryResponse[],
  messageId: string
): boolean {
  return pages.some((page) =>
    page.messages.some((msg) => msg.id === messageId)
  );
}

/**
 * Appends a new message to the last page
 */
function appendNewMessage(
  pages: MessageHistoryResponse[],
  message: MessageWithAuthorResponse
): MessageHistoryResponse[] {
  logDev("[Socket] Adding new message from another user");

  const newPages = [...pages];
  const lastPageIndex = newPages.length - 1;
  const lastPage = newPages[lastPageIndex];

  newPages[lastPageIndex] = {
    ...lastPage,
    messages: [...lastPage.messages, message],
  };

  return newPages;
}

/**
 * Updates the cache with a new or confirmed message
 * Handles three cases: replace optimistic, check duplicates, append new
 */
function updateCacheWithMessage(
  old: InfiniteData<MessageHistoryResponse> | undefined,
  message: MessageWithAuthorResponse
): InfiniteData<MessageHistoryResponse> | undefined {
  if (!old || !old.pages.length) return old;

  // All messages from Socket.IO have correlation IDs (required in backend)
  // Try to find and replace matching optimistic message first
  const correlationId = message.clientMessageCorrelationId;
  if (correlationId) {
    const updatedPages = replaceOptimisticMessage(
      old.pages,
      message,
      correlationId
    );
    if (updatedPages) {
      // Found and replaced optimistic message
      return { ...old, pages: updatedPages };
    }
  }

  // No optimistic message found - this is a message from another user
  // Check for duplicates first
  if (messageExists(old.pages, message.id)) {
    logDev("[Socket] Message already exists, ignoring");
    return old;
  }

  // New message from another user - append to last page
  const updatedPages = appendNewMessage(old.pages, message);
  return { ...old, pages: updatedPages };
}

/**
 * Handles incoming message:created events
 * Updates React Query cache if channel is loaded
 * Also increments unread count for non-active channels
 */
function createMessageHandler(
  queryClient: ReturnType<typeof useQueryClient>,
  incrementUnread: (workspaceId: string, channelId: string) => void,
  getActiveChannel: () => {
    workspaceId: string | null;
    channelId: string | null;
  },
  currentUserId: string | null
) {
  return function handleMessageCreated(message: MessageWithAuthorResponse) {
    logDev("[Socket] Received message:created", {
      messageId: message.id,
      channelId: message.channelId,
      hasCorrelationId: !!message.clientMessageCorrelationId,
    });

    const cacheKey = messageKeys.channel(
      message.workspaceId,
      message.channelId
    );

    // Check if cache exists for this channel
    const cache =
      queryClient.getQueryData<InfiniteData<MessageHistoryResponse>>(cacheKey);

    if (cache) {
      // Update the cache
      queryClient.setQueryData<InfiniteData<MessageHistoryResponse>>(
        cacheKey,
        (old) => updateCacheWithMessage(old, message)
      );
    } else {
      logDev("[Socket] No cache for channel, skipping cache update");
    }

    // Handle unread count increment
    // Don't increment for:
    // 1. Own messages (we're the sender)
    // 2. Messages in the currently active channel
    const { workspaceId: activeWorkspaceId, channelId: activeChannelId } =
      getActiveChannel();
    const isOwnMessage = message.userId === currentUserId;
    const isActiveChannel =
      message.workspaceId === activeWorkspaceId &&
      message.channelId === activeChannelId;

    if (!isOwnMessage && !isActiveChannel) {
      logDev("[Socket] Incrementing unread count for non-active channel", {
        workspaceId: message.workspaceId,
        channelId: message.channelId,
      });
      incrementUnread(message.workspaceId, message.channelId);
    }
  };
}

/**
 * Hook to listen to Socket.IO message events and update React Query cache
 *
 * Should be called once at the app level (in main app page).
 * Listens to all message:created events and updates the appropriate channel cache.
 * Also increments unread counts for messages in non-active channels.
 *
 * @param currentUserId - The ID of the current authenticated user
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   const { user } = useAuth();
 *   useMessageSocket(user?.id ?? null); // Listen to all message events
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useMessageSocket(currentUserId: string | null) {
  const queryClient = useQueryClient();
  const incrementUnread = useUnreadStore((state) => state.incrementUnread);
  const selectedWorkspaceId = useWorkspaceStore(
    (state) => state.selectedWorkspaceId
  );
  const selectedChannelId = useWorkspaceStore(
    (state) => state.selectedChannelId
  );

  // Memoize the getActiveChannel function to avoid recreating handler
  const getActiveChannel = useCallback(
    () => ({
      workspaceId: selectedWorkspaceId,
      channelId: selectedChannelId,
    }),
    [selectedWorkspaceId, selectedChannelId]
  );

  useEffect(() => {
    const socket = getSocket();
    const handleMessageCreated = createMessageHandler(
      queryClient,
      incrementUnread,
      getActiveChannel,
      currentUserId
    );

    // Register message event listener
    socket.on("message:created", handleMessageCreated);
    logDev("[Socket] Message listener registered");

    // Cleanup: remove listener on unmount
    return () => {
      socket.off("message:created", handleMessageCreated);
      logDev("[Socket] Message listener removed");
    };
  }, [queryClient, incrementUnread, getActiveChannel, currentUserId]);
}
