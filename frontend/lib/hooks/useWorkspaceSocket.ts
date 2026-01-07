/**
 * useWorkspaceSocket Hook
 * Listens to Socket.IO workspace events and updates React Query cache
 *
 * Handles workspace:deleted events by:
 * - Removing the workspace from the user memberships cache
 * - Removing all workspace members cache
 * - Removing all message caches for all channels in the workspace
 * - Leaving the socket room for the deleted workspace and all channels
 * - If user is viewing deleted workspace, switch to first available workspace or clear selection
 * - Showing a toast notification
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket/socketClient";
import {
  updateMembershipsCacheOnWorkspaceDeleted,
  removeMembersCacheOnWorkspaceDeleted,
} from "@/lib/socket/memberCacheHelpers";
import { messageKeys } from "@/lib/hooks/useMessageQueries";
import { useCurrentUser } from "@/lib/stores/user-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type {
  WorkspaceDeletedEventPayload,
  GetUserMembershipsResponse,
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
 * Creates an event handler for workspace:deleted events
 */
function createWorkspaceDeletedHandler(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUserId: string | undefined,
  selectedWorkspaceId: string | null,
  selectedChannelId: string | null,
  clearWorkspaceState: () => void,
  setSelectedWorkspace: (
    workspaceId: string | null,
    displayName?: string | null
  ) => void,
  setSelectedChannel: (
    channelId: string | null,
    displayName?: string | null
  ) => void
) {
  return (data: WorkspaceDeletedEventPayload) => {
    logDev("[Socket] Received workspace:deleted", {
      workspaceId: data.workspaceId,
      workspaceName: data.workspaceName,
      deletedBy: data.deletedBy,
      channelCount: data.channelIds.length,
    });

    // Update the memberships cache to remove the workspace
    updateMembershipsCacheOnWorkspaceDeleted(queryClient, data);

    // Remove workspace members cache
    removeMembersCacheOnWorkspaceDeleted(queryClient, data.workspaceId);

    // Remove all message caches for all channels in the workspace
    for (const channelId of data.channelIds) {
      queryClient.removeQueries({
        queryKey: messageKeys.channel(data.workspaceId, channelId),
      });
    }

    logDev("[Socket] Removed message caches for deleted workspace channels", {
      workspaceId: data.workspaceId,
      channelCount: data.channelIds.length,
    });

    // Leave the socket room for the workspace
    const socket = getSocket();
    socket.emit("leave_workspace", data.workspaceId);

    // Leave all channel rooms
    for (const channelId of data.channelIds) {
      socket.emit("leave_channel", {
        workspaceId: data.workspaceId,
        channelId,
      });
    }

    logDev("[Socket] Left deleted workspace and channel rooms", {
      workspaceId: data.workspaceId,
      channelCount: data.channelIds.length,
    });

    // Check if user was viewing the deleted workspace or is the deleter
    const wasViewingDeletedWorkspace = selectedWorkspaceId === data.workspaceId;
    const isDeleter = data.deletedBy === currentUserId;

    // If user was viewing the deleted workspace (including the deleter), switch/clear state
    if (wasViewingDeletedWorkspace) {
      // Get available workspaces AFTER cache update (deleted workspace already removed)
      const cacheKey = ["workspaces", "memberships", "with-channels"];
      const cachedData =
        queryClient.getQueryData<GetUserMembershipsResponse>(cacheKey);

      const availableWorkspaces = cachedData?.data?.workspaces || [];

      if (availableWorkspaces.length > 0) {
        // Switch to the first available workspace's general channel
        const firstWorkspace = availableWorkspaces[0];
        const generalChannel = firstWorkspace.channels?.find(
          (c) => c.name === "general"
        );

        // Update Zustand state to switch workspace and channel
        setSelectedWorkspace(
          firstWorkspace.id,
          firstWorkspace.displayName || firstWorkspace.name
        );

        if (generalChannel) {
          setSelectedChannel(
            generalChannel.id,
            generalChannel.displayName || generalChannel.name
          );
          logDev("[Socket] Switched to first available workspace", {
            workspaceId: firstWorkspace.id,
            channelId: generalChannel.id,
          });
        } else {
          // No general channel, just clear channel selection
          setSelectedChannel(null);
        }

        // Only show toast if not the deleter (they already know)
        if (!isDeleter) {
          toast.info(`Workspace "${data.workspaceName}" has been deleted`, {
            description: `Switched to "${firstWorkspace.displayName || firstWorkspace.name}"`,
          });
        }
      } else {
        // No other workspaces available - clear all state
        clearWorkspaceState();
        logDev("[Socket] No other workspaces available, cleared state");

        // Only show toast if not the deleter (they already know)
        if (!isDeleter) {
          toast.info(`Workspace "${data.workspaceName}" has been deleted`, {
            description: "Please create or join a workspace to continue",
          });
        }
      }
    } else if (!isDeleter) {
      // User was NOT viewing the deleted workspace and is NOT the deleter
      // Just show a notification
      toast.info(`Workspace "${data.workspaceName}" has been deleted`);
    }
  };
}

/**
 * Hook to listen to Socket.IO workspace events and update React Query cache
 *
 * Should be called once at the app level (in main app page).
 * Listens to workspace:deleted events and updates the appropriate caches.
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   useWorkspaceSocket(); // Listen to workspace events
 *   useChannelSocket();   // Listen to channel events
 *   useMemberSocket();    // Listen to member events
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useWorkspaceSocket() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const {
    selectedWorkspaceId,
    selectedChannelId,
    clearWorkspaceState,
    setSelectedWorkspace,
    setSelectedChannel,
  } = useWorkspaceStore();

  useEffect(() => {
    const socket = getSocket();

    // Create event handler
    const handleWorkspaceDeleted = createWorkspaceDeletedHandler(
      queryClient,
      currentUser?.id,
      selectedWorkspaceId,
      selectedChannelId,
      clearWorkspaceState,
      setSelectedWorkspace,
      setSelectedChannel
    );

    // Register event listener
    socket.on("workspace:deleted", handleWorkspaceDeleted);

    logDev("[Socket] Workspace event listeners registered");

    // Cleanup: remove listener on unmount
    return () => {
      socket.off("workspace:deleted", handleWorkspaceDeleted);
      logDev("[Socket] Workspace event listeners removed");
    };
  }, [
    queryClient,
    currentUser?.id,
    selectedWorkspaceId,
    selectedChannelId,
    clearWorkspaceState,
    setSelectedWorkspace,
    setSelectedChannel,
  ]);
}
