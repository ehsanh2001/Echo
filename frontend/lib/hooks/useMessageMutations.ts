"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessage } from "@/lib/api/message";
import { messageKeys } from "@/lib/hooks/useMessageQueries";
import type {
  SendMessageRequest,
  OptimisticMessage,
  MessageWithAuthorResponse,
} from "@/types/message";
import { toast } from "sonner";
import { useUserStore } from "@/lib/stores/user-store";

/**
 * Context type for mutation callbacks
 */
interface SendMessageContext {
  optimisticMessage: OptimisticMessage;
  previousData?: any; // Will be typed properly when implementing message history
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
      // Create optimistic message
      const optimisticMessage: OptimisticMessage = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        workspaceId,
        channelId,
        userId: user?.id || "unknown",
        content: variables.content,
        createdAt: new Date(),
        isPending: true,
        author: {
          id: user?.id || "unknown",
          username: user?.username || "You",
          displayName: user?.displayName || user?.username || "You",
          avatarUrl: user?.avatarUrl || null,
        },
        retryCount: 0,
      };

      // Note: Actual optimistic update to cache will be implemented
      // when we add the message list/history feature.
      // For now, we'll just track the optimistic message in the context.

      return { optimisticMessage };
    },

    onSuccess: (response, variables, context) => {
      // Successfully sent message - invalidate cache to refetch
      queryClient.invalidateQueries({
        queryKey: messageKeys.channel(workspaceId, channelId),
      });

      console.log("Message sent successfully:", response.data.id);
    },

    onError: (error: any, variables, context) => {
      // Show error toast
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Failed to send message. It will be retried.";

      toast.error(errorMessage);
      console.error("Error sending message:", error);

      // Note: Failed messages will be stored in localStorage
      // for retry after reconnection (future implementation)
    },

    onSettled: (data, error, variables, context) => {
      // Ensure cache is always invalidated after mutation completes
      queryClient.invalidateQueries({
        queryKey: messageKeys.channel(workspaceId, channelId),
      });
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
