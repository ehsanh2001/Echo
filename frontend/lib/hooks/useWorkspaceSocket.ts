/**
 * useWorkspaceSocket Hook
 * Listens to Socket.IO workspace events and updates React Query cache
 *
 * Handles workspace:deleted events by:
 * - Removing the workspace from the user memberships cache
 * - Removing all workspace members cache
 * - Removing all message caches for all channels in the workspace
 * - Leaving the socket room for the deleted workspace and all channels
 * - If user is viewing deleted workspace, redirect to first available workspace or workspace selection
 * - Showing a toast notification
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  router: ReturnType<typeof useRouter>
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

    // Check if user was viewing the deleted workspace
    const wasViewingDeletedWorkspace = selectedWorkspaceId === data.workspaceId;

    if (wasViewingDeletedWorkspace) {
      // Find the first available workspace to redirect to
      const cacheKey = ["workspaces", "memberships", "with-channels"];
      const cachedData =
        queryClient.getQueryData<GetUserMembershipsResponse>(cacheKey);

      const availableWorkspaces = cachedData?.data?.workspaces?.filter(
        (w) => w.id !== data.workspaceId
      );

      if (availableWorkspaces && availableWorkspaces.length > 0) {
        // Redirect to the first available workspace's general channel
        const firstWorkspace = availableWorkspaces[0];
        const generalChannel = firstWorkspace.channels?.find(
          (c) => c.name === "general"
        );

        if (generalChannel) {
          router.push(
            `/app/${firstWorkspace.id}/channels/${generalChannel.id}`
          );
          logDev("[Socket] Redirected to first available workspace", {
            workspaceId: firstWorkspace.id,
            channelId: generalChannel.id,
          });
        } else {
          // Fallback: redirect to workspace page
          router.push(`/app/${firstWorkspace.id}`);
        }

        toast.info(`Workspace "${data.workspaceName}" has been deleted`, {
          description: `Redirected to "${firstWorkspace.displayName || firstWorkspace.name}"`,
        });
      } else {
        // No other workspaces available - redirect to workspace selection
        clearWorkspaceState();
        router.push("/app");
        logDev("[Socket] No other workspaces available, redirected to /app");

        toast.info(`Workspace "${data.workspaceName}" has been deleted`, {
          description: "Please create or join a workspace to continue",
        });
      }
    } else {
      // Show toast notification for deleted workspace
      // Don't show if the current user deleted the workspace (they already know)
      const isDeleter = data.deletedBy === currentUserId;
      if (!isDeleter) {
        toast.info(`Workspace "${data.workspaceName}" has been deleted`);
      }
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
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { selectedWorkspaceId, selectedChannelId, clearWorkspaceState } =
    useWorkspaceStore();

  useEffect(() => {
    const socket = getSocket();

    // Create event handler
    const handleWorkspaceDeleted = createWorkspaceDeletedHandler(
      queryClient,
      currentUser?.id,
      selectedWorkspaceId,
      selectedChannelId,
      clearWorkspaceState,
      router
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
    router,
    currentUser?.id,
    selectedWorkspaceId,
    selectedChannelId,
    clearWorkspaceState,
  ]);
}
