/**
 * useChannelSocket Hook
 * Listens to Socket.IO channel events and updates React Query cache
 *
 * Handles channel:created events by:
 * - Adding the new channel to the workspace members cache
 * - Adding the new channel to the user memberships cache (sidebar)
 * - Auto-joining the socket room for the new channel
 * - Showing a toast notification
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket/socketClient";
import {
  updateMembersCacheWithNewChannel,
  updateMembershipsCacheWithNewChannel,
} from "@/lib/socket/memberCacheHelpers";
import { useCurrentUser } from "@/lib/stores/user-store";
import type { ChannelCreatedEventPayload } from "@/types/workspace";

/**
 * Logs debug information in development mode
 */
function logDev(message: string, data?: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.log(message, data);
  }
}

/**
 * Creates an event handler for channel:created events
 */
function createChannelCreatedHandler(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUserId: string | undefined
) {
  return (data: ChannelCreatedEventPayload) => {
    logDev("[Socket] Received channel:created", {
      channelId: data.channelId,
      channelName: data.channelName,
      workspaceId: data.workspaceId,
      isPrivate: data.isPrivate,
      memberCount: data.members.length,
    });

    // Check if current user is a member of this channel
    const isCurrentUserMember =
      currentUserId && data.members.some((m) => m.userId === currentUserId);

    if (!isCurrentUserMember) {
      logDev("[Socket] Current user is not a member of this channel, skipping");
      return;
    }

    // Update the members cache with the new channel
    updateMembersCacheWithNewChannel(queryClient, data.workspaceId, data);

    // Update the memberships cache (sidebar channel list)
    updateMembershipsCacheWithNewChannel(queryClient, data);

    // Auto-join the socket room for the new channel
    const socket = getSocket();
    socket.emit("join_channel", {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
    });

    logDev("[Socket] Auto-joined channel room", {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
    });

    // Show toast notification for new channel
    // Don't show if the current user created the channel (they already know)
    const isCreator = data.createdBy === currentUserId;
    if (!isCreator) {
      const channelDisplayName = data.channelDisplayName || data.channelName;
      const channelTypeLabel = data.isPrivate ? "private" : "public";
      toast.success(`New ${channelTypeLabel} channel: #${channelDisplayName}`, {
        description: "You've been added as a member",
      });
    }
  };
}

/**
 * Hook to listen to Socket.IO channel events and update React Query cache
 *
 * Should be called once at the app level (in main app page).
 * Listens to channel:created events and updates the appropriate caches.
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   useChannelSocket(); // Listen to channel events
 *   useMemberSocket();  // Listen to member events
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useChannelSocket() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  useEffect(() => {
    const socket = getSocket();

    // Create event handler
    const handleChannelCreated = createChannelCreatedHandler(
      queryClient,
      currentUser?.id
    );

    // Register event listener
    socket.on("channel:created", handleChannelCreated);

    logDev("[Socket] Channel event listeners registered");

    // Cleanup: remove listeners on unmount
    return () => {
      socket.off("channel:created", handleChannelCreated);
      logDev("[Socket] Channel event listeners removed");
    };
    // Note: queryClient is a stable reference from QueryClientProvider
    // currentUser.id should be stable once the user is authenticated
  }, [queryClient, currentUser?.id]);
}
