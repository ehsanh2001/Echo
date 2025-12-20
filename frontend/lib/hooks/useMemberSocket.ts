/**
 * useMemberSocket Hook
 * Listens to Socket.IO member events and updates React Query cache
 *
 * Handles member join/leave events for both workspaces and channels.
 * Updates the members cache by adding or removing members from the appropriate lists.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket/socketClient";
import {
  updateWorkspaceMemberCache,
  updateChannelMemberCache,
} from "@/lib/socket/memberCacheHelpers";
import type { MemberEventUserInfo } from "@/lib/socket/types";

/**
 * Logs debug information in development mode
 */
function logDev(message: string, data?: any) {
  if (process.env.NODE_ENV === "development") {
    console.log(message, data);
  }
}

/**
 * Creates an event handler for workspace member joined
 */
function createWorkspaceMemberJoinedHandler(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return (data: {
    workspaceId: string;
    userId: string;
    user: MemberEventUserInfo;
  }) => {
    logDev("[Socket] Received workspace:member:joined", {
      workspaceId: data.workspaceId,
      userId: data.userId,
    });

    updateWorkspaceMemberCache(
      queryClient,
      data.workspaceId,
      data.userId,
      data.user
    );
  };
}

/**
 * Creates an event handler for workspace member left
 */
function createWorkspaceMemberLeftHandler(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return (data: { workspaceId: string; userId: string }) => {
    logDev("[Socket] Received workspace:member:left", {
      workspaceId: data.workspaceId,
      userId: data.userId,
    });

    updateWorkspaceMemberCache(
      queryClient,
      data.workspaceId,
      data.userId,
      null
    );
  };
}

/**
 * Creates an event handler for channel member joined
 */
function createChannelMemberJoinedHandler(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return (data: {
    workspaceId: string;
    channelId: string;
    userId: string;
    user: MemberEventUserInfo;
  }) => {
    logDev("[Socket] Received channel:member:joined", {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      userId: data.userId,
    });

    updateChannelMemberCache(
      queryClient,
      data.workspaceId,
      data.channelId,
      data.userId,
      data.user
    );
  };
}

/**
 * Creates an event handler for channel member left
 */
function createChannelMemberLeftHandler(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return (data: { workspaceId: string; channelId: string; userId: string }) => {
    logDev("[Socket] Received channel:member:left", {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      userId: data.userId,
    });

    updateChannelMemberCache(
      queryClient,
      data.workspaceId,
      data.channelId,
      data.userId,
      null
    );
  };
}

/**
 * Hook to listen to Socket.IO member events and update React Query cache
 *
 * Should be called once at the app level (in main app page).
 * Listens to all member join/leave events and updates the appropriate workspace cache.
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   useMemberSocket(); // Listen to all member events
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useMemberSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    // Create event handlers
    const handleWorkspaceMemberJoined =
      createWorkspaceMemberJoinedHandler(queryClient);
    const handleWorkspaceMemberLeft =
      createWorkspaceMemberLeftHandler(queryClient);
    const handleChannelMemberJoined =
      createChannelMemberJoinedHandler(queryClient);
    const handleChannelMemberLeft = createChannelMemberLeftHandler(queryClient);

    // Register event listeners
    socket.on("workspace:member:joined", handleWorkspaceMemberJoined);
    socket.on("workspace:member:left", handleWorkspaceMemberLeft);
    socket.on("channel:member:joined", handleChannelMemberJoined);
    socket.on("channel:member:left", handleChannelMemberLeft);

    logDev("[Socket] Member event listeners registered");

    // Cleanup: remove listeners on unmount
    return () => {
      socket.off("workspace:member:joined", handleWorkspaceMemberJoined);
      socket.off("workspace:member:left", handleWorkspaceMemberLeft);
      socket.off("channel:member:joined", handleChannelMemberJoined);
      socket.off("channel:member:left", handleChannelMemberLeft);
      logDev("[Socket] Member event listeners removed");
    };
    // Note: queryClient is a stable reference from QueryClientProvider
    // It doesn't change when cache updates occur, so this effect only runs once
  }, [queryClient]);
}
