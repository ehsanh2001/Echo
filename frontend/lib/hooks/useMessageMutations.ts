"use client";

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { sendMessage } from "@/lib/api/message";
import { messageKeys } from "@/lib/hooks/useMessageQueries";
import type {
  SendMessageRequest,
  OptimisticMessage,
  MessageWithAuthorResponse,
  MessageHistoryResponse,
} from "@/types/message";
import { toast } from "sonner";
import { useUserStore } from "@/lib/stores/user-store";

/**
 * Context type for mutation callbacks
 */
interface SendMessageContext {
  optimisticMessage: OptimisticMessage;
  correlationId: string;
  previousMessages?: InfiniteData<MessageHistoryResponse>;
}

/**
 * Hook to send a message to a channel with optimistic updates
 *
 * Features:
 * - Optimistic UI updates (message appears immediately)
 * - Automatic retry with exponential backoff (max 30s)
 * - Error handling with toast notifications
 * - Local storage persistence for failed messages (future)
 *
 * @param workspaceId - The workspace ID
 * @param channelId - The channel ID
 * @returns React Query mutation object
 *
 * @example
 * ```typescript
 * const sendMessageMutation = useSendMessage(workspaceId, channelId);
 *
 * const handleSend = (content: string) => {
 *   sendMessageMutation.mutate({ content });
 * };
 *
 * // Check pending state
 * if (sendMessageMutation.isPending) {
 *   console.log('Sending...');
 * }
 * ```
 */
export function useSendMessage(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  const user = useUserStore((state) => state.user);

  return useMutation({
    mutationFn: async (data: SendMessageRequest) => {
      return sendMessage(workspaceId, channelId, data);
    },

    // Retry failed mutations with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s, 4s, capped at 30s
      const delay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
      return delay;
    },

    onMutate: async (variables: SendMessageRequest) => {
      // Use the correlation ID from the request (generated in MessageInput)
      const correlationId = variables.clientMessageCorrelationId;

      // Create optimistic message
      const optimisticMessage: OptimisticMessage = {
        id: `optimistic-${correlationId}`,
        workspaceId,
        channelId,
        userId: user?.id || "unknown",
        content: variables.content,
        createdAt: new Date(),
        isPending: true,
        clientMessageCorrelationId: correlationId,
        author: {
          id: user?.id || "unknown",
          username: user?.username || "You",
          displayName: user?.displayName || user?.username || "You",
          avatarUrl: user?.avatarUrl || null,
        },
        retryCount: 0,
      };

      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: messageKeys.channel(workspaceId, channelId),
      });

      // Snapshot previous messages for rollback
      const previousMessages = queryClient.getQueryData<
        InfiniteData<MessageHistoryResponse>
      >(messageKeys.channel(workspaceId, channelId));

      // Optimistically update the cache
      queryClient.setQueryData<InfiniteData<MessageHistoryResponse>>(
        messageKeys.channel(workspaceId, channelId),
        (old) => {
          if (!old || !old.pages.length) return old;

          const newPages = [...old.pages];
          const lastPageIndex = newPages.length - 1;
          const lastPage = newPages[lastPageIndex];

          // Add optimistic message to the end of the last page (newest messages)
          newPages[lastPageIndex] = {
            ...lastPage,
            messages: [...lastPage.messages, optimisticMessage as any],
          };

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      return { optimisticMessage, correlationId, previousMessages };
    },

    onSuccess: (response, variables, context) => {
      // Message sent successfully to backend
      // Socket.IO will handle updating the cache when message:created event arrives
      // No need to invalidate queries here - socket listener will replace optimistic message
      if (process.env.NODE_ENV === "development") {
        console.log("Message sent successfully:", response.data.id);
      }
    },

    onError: (error: any, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          messageKeys.channel(workspaceId, channelId),
          context.previousMessages
        );
      }

      // Show error toast
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Failed to send message. Please try again.";

      toast.error(errorMessage);
      console.error("Error sending message:", error);
    },

    onSettled: (data, error, variables, context) => {
      // No need to invalidate - socket will handle updates
      // Only invalidate on error if rollback didn't happen
      if (error && !context?.previousMessages) {
        queryClient.invalidateQueries({
          queryKey: messageKeys.channel(workspaceId, channelId),
        });
      }
    },
  });
}

/**
 * Hook to retry a failed message
 *
 * Will be implemented when we add failed message persistence.
 */
export function useRetryMessage(workspaceId: string, channelId: string) {
  // Placeholder for future implementation
  return useSendMessage(workspaceId, channelId);
}
