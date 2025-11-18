/**
 * React Query mutations for channel operations
 * Handles creating, updating, and deleting channels
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChannel } from "@/lib/api/channel";
import { workspaceKeys } from "@/lib/hooks/useWorkspaces";
import type {
  CreateChannelRequest,
  CreateChannelResponse,
} from "@/types/workspace";
import { toast } from "sonner";

/**
 * Hook for creating a new channel
 *
 * Automatically:
 * - Manages loading/error states
 * - Invalidates workspace cache on success to refresh channel list
 * - Shows error toast on failure
 * - Returns the created channel data
 *
 */
export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChannelRequest) => createChannel(data),

    onSuccess: (response) => {
      // Invalidate workspace memberships to refresh channel list
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membershipsWithChannels(),
      });

      // Show success toast
      toast.success("Channel created successfully!");
    },

    onError: (error: any) => {
      // Show error toast
      const errorMessage =
        error?.message || "Failed to create channel. Please try again.";
      toast.error(errorMessage);
      console.error("Error creating channel:", error);
    },

    // Retry failed mutations once
    retry: 1,
  });
}

/**
 * Hook for updating an existing channel
 * (Placeholder for future implementation)
 */
export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      channelId,
      data,
    }: {
      workspaceId: string;
      channelId: string;
      data: Partial<CreateChannelRequest>;
    }) => {
      // TODO: Implement update API call
      throw new Error("Not implemented yet");
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membershipsWithChannels(),
      });
      toast.success("Channel updated successfully!");
    },

    onError: (error: any) => {
      toast.error(error?.message || "Failed to update channel");
    },
  });
}

/**
 * Hook for deleting a channel
 * (Placeholder for future implementation)
 */
export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      channelId,
    }: {
      workspaceId: string;
      channelId: string;
    }) => {
      // TODO: Implement delete API call
      throw new Error("Not implemented yet");
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membershipsWithChannels(),
      });
      toast.success("Channel deleted successfully!");
    },

    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete channel");
    },
  });
}
