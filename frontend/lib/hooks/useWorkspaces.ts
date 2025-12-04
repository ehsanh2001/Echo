/**
 * React Query hooks for workspace-related data
 *
 * Architecture:
 * - React Query: Manages server state (workspaces, channels data)
 * - Zustand: Manages client state (selectedWorkspaceId)
 * - Selector hooks: Combine both for convenient access
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getUserMemberships } from "@/lib/api/workspace";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { GetUserMembershipsResponse } from "@/types/workspace";

/**
 * Query key factory for workspace-related queries
 * Centralized query keys for better cache management
 */
export const workspaceKeys = {
  all: ["workspaces"] as const,
  memberships: () => [...workspaceKeys.all, "memberships"] as const,
  membershipsWithChannels: () =>
    [...workspaceKeys.memberships(), "with-channels"] as const,
  details: (id: string) => [...workspaceKeys.all, "details", id] as const,
};

/**
 * Hook to fetch user's workspace memberships with channels
 *
 * Automatically fetches all workspaces the user belongs to, including:
 * - Workspace details (id, name, displayName, etc.)
 * - User's role in each workspace
 * - Member count
 * - All channels in each workspace (with user's membership info)
 *
 * Data is cached for 5 minutes and automatically refetched in the background
 * when the window regains focus.
 *
 * @param includeChannels - Whether to include channel data (default: true)
 * @returns React Query result with workspaces data
 *
 * @example
 * ```tsx
 * function WorkspaceList() {
 *   const { data, isLoading, error } = useWorkspaceMemberships();
 *   const workspaces = data?.data?.workspaces || [];
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>{workspaces.length} workspaces</div>;
 * }
 * ```
 */
export function useWorkspaceMemberships(includeChannels: boolean = true) {
  const { selectedWorkspaceId, setSelectedWorkspace } = useWorkspaceStore();

  // Check if user is authenticated to prevent auto-select after logout
  const isAuthenticated =
    typeof window !== "undefined" && !!localStorage.getItem("access_token");

  const query = useQuery({
    queryKey: includeChannels
      ? workspaceKeys.membershipsWithChannels()
      : workspaceKeys.memberships(),
    queryFn: () => getUserMemberships(includeChannels),
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes (renamed from cacheTime in React Query v5)
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Refetch when component mounts
    retry: 2, // Retry failed requests twice
  });

  // Auto-select first workspace if none selected and data is available
  useEffect(() => {
    // Don't auto-select if user is not authenticated (e.g., after logout)
    if (!isAuthenticated) return;

    const workspaces = query.data?.data?.workspaces;
    if (!workspaces) return;

    // If no workspace selected and workspaces exist, select first one
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspace(
        workspaces[0].id,
        workspaces[0].displayName || workspaces[0].name
      );
    }

    // If selected workspace no longer exists, select first available or null
    if (
      selectedWorkspaceId &&
      !workspaces.find((w) => w.id === selectedWorkspaceId)
    ) {
      const firstWorkspace = workspaces[0];
      setSelectedWorkspace(
        workspaces.length > 0 ? firstWorkspace.id : null,
        workspaces.length > 0
          ? firstWorkspace.displayName || firstWorkspace.name
          : null
      );
    }
  }, [query.data, selectedWorkspaceId, setSelectedWorkspace, isAuthenticated]);

  return query;
}

/**
 * Hook to manually refetch workspace memberships
 *
 * Returns a function that can be called to trigger a fresh fetch
 * of workspace memberships data. Useful for refresh buttons.
 *
 * @example
 * ```tsx
 * function RefreshButton() {
 *   const refetchMemberships = useRefetchMemberships();
 *
 *   return (
 *     <button onClick={() => refetchMemberships()}>
 *       Refresh Workspaces
 *     </button>
 *   );
 * }
 * ```
 */
export function useRefetchMemberships() {
  const queryClient = useQueryClient();

  return () => {
    return queryClient.invalidateQueries({
      queryKey: workspaceKeys.memberships(),
    });
  };
}

/**
 * Selector hook to get the currently selected workspace
 *
 * Combines React Query data (workspaces) with Zustand state (selectedWorkspaceId)
 * to return the currently selected workspace object.
 *
 * @returns The selected workspace or undefined if none selected
 *
 * @example
 * ```tsx
 * function WorkspaceHeader() {
 *   const selectedWorkspace = useSelectedWorkspace();
 *
 *   if (!selectedWorkspace) return <div>No workspace selected</div>;
 *
 *   return <h1>{selectedWorkspace.displayName || selectedWorkspace.name}</h1>;
 * }
 * ```
 */
export function useSelectedWorkspace() {
  const selectedWorkspaceId = useWorkspaceStore(
    (state) => state.selectedWorkspaceId
  );

  // Use the actual query hook to subscribe to data changes
  const { data } = useWorkspaceMemberships();

  return useMemo(() => {
    if (!data?.data?.workspaces || !selectedWorkspaceId) {
      return undefined;
    }

    return data.data.workspaces.find((w) => w.id === selectedWorkspaceId);
  }, [data, selectedWorkspaceId]);
}

/**
 * Selector hook to get channels from the selected workspace
 *
 * Combines React Query data with Zustand state to return only the channels
 * belonging to the currently selected workspace.
 *
 * @returns Array of channels from selected workspace (empty array if none)
 *
 * @example
 * ```tsx
 * function ChannelList() {
 *   const channels = useSelectedWorkspaceChannels();
 *
 *   return (
 *     <div>
 *       {channels.map(channel => (
 *         <div key={channel.id}>{channel.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSelectedWorkspaceChannels() {
  const selectedWorkspace = useSelectedWorkspace();
  return useMemo(() => selectedWorkspace?.channels || [], [selectedWorkspace]);
}
