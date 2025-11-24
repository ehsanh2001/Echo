/**
 * useWorkspaceRooms Hook
 * Manages Socket.IO room membership for workspaces and channels
 *
 * Automatically joins all workspace and channel rooms when the user's
 * workspace memberships are loaded. This enables:
 * - Real-time message updates across all channels
 * - Future: Unread count notifications
 * - Future: Workspace-level events
 *
 * Handles:
 * - Joining all rooms on mount or when data changes
 * - Leaving all rooms on unmount
 * - Rejoining rooms on socket reconnection
 */

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import type { WorkspaceMembershipResponse } from "@/types/workspace";

interface UseWorkspaceRoomsOptions {
  /**
   * Array of workspace memberships (includes channels)
   */
  workspaces: WorkspaceMembershipResponse[] | undefined;

  /**
   * Whether to enable room management
   * Set to false to disable (e.g., when not authenticated)
   */
  enabled?: boolean;
}

/**
 * Hook to manage Socket.IO room memberships for workspaces and channels
 *
 * Automatically joins all workspace and channel rooms the user is a member of.
 * Rejoins rooms on socket reconnection.
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   const { data } = useWorkspaceMemberships(true);
 *   const workspaces = data?.data?.workspaces;
 *
 *   useWorkspaceRooms({ workspaces });
 *
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useWorkspaceRooms({
  workspaces,
  enabled = true,
}: UseWorkspaceRoomsOptions) {
  // Track current room memberships to avoid unnecessary joins/leaves
  const currentRoomsRef = useRef<Set<string>>(new Set());

  // Function to join all rooms
  const joinAllRooms = () => {
    if (!enabled || !workspaces || workspaces.length === 0) {
      return;
    }

    const socket = getSocket();
    const newRooms = new Set<string>();

    // Join all workspace rooms and their channel rooms
    workspaces.forEach((workspace) => {
      const workspaceRoomId = `workspace:${workspace.id}`;

      // Join workspace room
      if (!currentRoomsRef.current.has(workspaceRoomId)) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[Rooms] Joining workspace room: ${workspaceRoomId}`);
        }
        socket.emit("join_workspace", workspace.id);
      }
      newRooms.add(workspaceRoomId);

      // Join all channel rooms in this workspace
      if (workspace.channels && workspace.channels.length > 0) {
        workspace.channels.forEach((channel) => {
          const channelRoomId = `workspace:${workspace.id}:channel:${channel.id}`;

          if (!currentRoomsRef.current.has(channelRoomId)) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[Rooms] Joining channel room: ${channelRoomId}`);
            }
            socket.emit("join_channel", {
              workspaceId: workspace.id,
              channelId: channel.id,
            });
          }
          newRooms.add(channelRoomId);
        });
      }
    });

    // Update current rooms reference
    currentRoomsRef.current = newRooms;
  };

  // Function to leave all rooms
  const leaveAllRooms = () => {
    if (!workspaces || workspaces.length === 0) {
      return;
    }

    const socket = getSocket();

    workspaces.forEach((workspace) => {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Rooms] Leaving workspace room: workspace:${workspace.id}`
        );
      }
      socket.emit("leave_workspace", workspace.id);

      if (workspace.channels && workspace.channels.length > 0) {
        workspace.channels.forEach((channel) => {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `[Rooms] Leaving channel room: workspace:${workspace.id}:channel:${channel.id}`
            );
          }
          socket.emit("leave_channel", {
            workspaceId: workspace.id,
            channelId: channel.id,
          });
        });
      }
    });

    // Clear current rooms reference
    currentRoomsRef.current.clear();
  };

  // Join rooms on mount or when workspaces change
  // Also handle socket reconnection
  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();

    // Join all rooms initially
    joinAllRooms();

    // Handle socket reconnection - rejoin all rooms
    const handleReconnect = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Rooms] Socket reconnected, rejoining all rooms");
      }

      // Clear current rooms and rejoin
      currentRoomsRef.current.clear();
      joinAllRooms();
    };

    socket.io.on("reconnect", handleReconnect);

    // Cleanup: leave all rooms and remove reconnect handler on unmount
    return () => {
      leaveAllRooms();
      socket.io.off("reconnect", handleReconnect);
    };
  }, [workspaces, enabled]);
}
