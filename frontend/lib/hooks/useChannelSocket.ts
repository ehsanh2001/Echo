/**
 * useChannelSocket Hook
 * Listens to Socket.IO channel events and updates React Query cache
 *
 * Handles channel:created events by:
 * - Adding the new channel to the workspace members cache
 * - Adding the new channel to the user memberships cache (sidebar)
 * - Auto-joining the socket room for the new channel
 * - Showing a toast notification
 *
 * Handles channel:deleted events by:
 * - Removing the channel from the workspace members cache
 * - Removing the channel from the user memberships cache (sidebar)
 * - Leaving the socket room for the deleted channel
 * - If user is viewing deleted channel, redirect to general channel
 * - Showing a toast notification
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket/socketClient";
import {
  updateMembersCacheWithNewChannel,
  updateMembershipsCacheWithNewChannel,
  updateMembersCacheOnChannelDeleted,
  updateMembershipsCacheOnChannelDeleted,
} from "@/lib/socket/memberCacheHelpers";
import { useCurrentUser } from "@/lib/stores/user-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type {
  ChannelCreatedEventPayload,
  ChannelDeletedEventPayload,
} from "@/types/workspace";

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
 * Creates an event handler for channel:deleted events
 */
function createChannelDeletedHandler(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUserId: string | undefined,
  selectedChannelId: string | null,
  clearSelectedChannel: () => void,
  findGeneralChannel: (
    workspaceId: string
  ) => { id: string; displayName: string | null } | null,
  setSelectedChannel: (channelId: string, displayName: string | null) => void
) {
  return (data: ChannelDeletedEventPayload) => {
    logDev("[Socket] Received channel:deleted", {
      channelId: data.channelId,
      channelName: data.channelName,
      workspaceId: data.workspaceId,
      deletedBy: data.deletedBy,
    });

    // Update the members cache to remove the channel
    updateMembersCacheOnChannelDeleted(
      queryClient,
      data.workspaceId,
      data.channelId
    );

    // Update the memberships cache (sidebar channel list)
    updateMembershipsCacheOnChannelDeleted(queryClient, data);

    // Leave the socket room for the deleted channel
    const socket = getSocket();
    socket.emit("leave_channel", {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
    });

    logDev("[Socket] Left deleted channel room", {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
    });

    // Check if user was viewing the deleted channel
    const wasViewingDeletedChannel = selectedChannelId === data.channelId;

    if (wasViewingDeletedChannel) {
      // Find the general channel to redirect to
      const generalChannel = findGeneralChannel(data.workspaceId);

      if (generalChannel) {
        setSelectedChannel(generalChannel.id, generalChannel.displayName);
        logDev("[Socket] Redirected to general channel", {
          channelId: generalChannel.id,
        });
      } else {
        // Fallback: just clear the selected channel
        clearSelectedChannel();
      }

      // Show toast that they were redirected
      toast.info(`Channel #${data.channelName} has been deleted`, {
        description: "You've been redirected to the general channel",
      });
    } else {
      // Show toast notification for deleted channel
      // Don't show if the current user deleted the channel (they already know)
      const isDeleter = data.deletedBy === currentUserId;
      if (!isDeleter) {
        toast.info(`Channel #${data.channelName} has been deleted`);
      }
    }
  };
}

/**
 * Hook to listen to Socket.IO channel events and update React Query cache
 *
 * Should be called once at the app level (in main app page).
 * Listens to channel:created and channel:deleted events and updates the appropriate caches.
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
  const { selectedChannelId, clearSelectedChannel, setSelectedChannel } =
    useWorkspaceStore();

  useEffect(() => {
    const socket = getSocket();

    // Helper function to find the general channel in a workspace
    const findGeneralChannel = (
      workspaceId: string
    ): { id: string; displayName: string | null } | null => {
      const cacheKey = ["workspaces", "memberships", "with-channels"];
      const cachedData = queryClient.getQueryData<{
        data?: {
          workspaces: Array<{
            id: string;
            channels?: Array<{
              id: string;
              name: string;
              displayName: string | null;
            }>;
          }>;
        };
      }>(cacheKey);

      const workspace = cachedData?.data?.workspaces?.find(
        (w) => w.id === workspaceId
      );
      const generalChannel = workspace?.channels?.find(
        (c) => c.name === "general"
      );

      return generalChannel
        ? { id: generalChannel.id, displayName: generalChannel.displayName }
        : null;
    };

    // Create event handlers
    const handleChannelCreated = createChannelCreatedHandler(
      queryClient,
      currentUser?.id
    );

    const handleChannelDeleted = createChannelDeletedHandler(
      queryClient,
      currentUser?.id,
      selectedChannelId,
      clearSelectedChannel,
      findGeneralChannel,
      setSelectedChannel
    );

    // Register event listeners
    socket.on("channel:created", handleChannelCreated);
    socket.on("channel:deleted", handleChannelDeleted);

    logDev("[Socket] Channel event listeners registered");

    // Cleanup: remove listeners on unmount
    return () => {
      socket.off("channel:created", handleChannelCreated);
      socket.off("channel:deleted", handleChannelDeleted);
      logDev("[Socket] Channel event listeners removed");
    };
    // Note: queryClient is a stable reference from QueryClientProvider
    // currentUser.id should be stable once the user is authenticated
    // selectedChannelId changes when user navigates to different channel
  }, [
    queryClient,
    currentUser?.id,
    selectedChannelId,
    clearSelectedChannel,
    setSelectedChannel,
  ]);
}
