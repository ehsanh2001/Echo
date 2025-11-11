/**
 * React Query hooks for workspace-related data
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserMemberships } from "@/lib/api/workspace";
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
 *   const { data, isLoading, error, refetch } = useWorkspaceMemberships();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error loading workspaces</div>;
 *
 *   return data?.data.workspaces.map(workspace => (
 *     <div key={workspace.id}>{workspace.displayName || workspace.name}</div>
 *   ));
 * }
 * ```
 */
export function useWorkspaceMemberships(includeChannels: boolean = true) {
  return useQuery({
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
