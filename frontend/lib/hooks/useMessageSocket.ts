/**
 * useMessageSocket Hook
 * Listens to Socket.IO message events and updates React Query cache
 *
 * Handles two types of messages:
 * 1. Own messages (with clientMessageCorrelationId) - replaces optimistic message
 * 2. Messages from other users - adds to cache if channel is loaded
 */

import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket/socketClient";
import { messageKeys } from "./useMessageQueries";
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
 */
function createMessageHandler(queryClient: ReturnType<typeof useQueryClient>) {
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

    if (!cache) {
      logDev("[Socket] No cache for channel, ignoring message");
      return;
    }

    // Update the cache
    queryClient.setQueryData<InfiniteData<MessageHistoryResponse>>(
      cacheKey,
      (old) => updateCacheWithMessage(old, message)
    );
  };
}

/**
 * Hook to listen to Socket.IO message events and update React Query cache
 *
 * Should be called once at the app level (in main app page).
 * Listens to all message:created events and updates the appropriate channel cache.
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   useMessageSocket(); // Listen to all message events
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useMessageSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const handleMessageCreated = createMessageHandler(queryClient);

    // Register message event listener
    socket.on("message:created", handleMessageCreated);
    logDev("[Socket] Message listener registered");

    // Cleanup: remove listener on unmount
    return () => {
      socket.off("message:created", handleMessageCreated);
      logDev("[Socket] Message listener removed");
    };
  }, [queryClient]);
}
