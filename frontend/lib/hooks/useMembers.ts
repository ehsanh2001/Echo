/**
 * React Query hooks for workspace and channel members
 *
 * Architecture:
 * - React Query: Manages server state (member data)
 * - Zustand: Manages client state (selectedWorkspaceId, selectedChannelId)
 * - Selector hooks: Combine both for convenient access to current members
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getWorkspaceMembers } from "@/lib/api/workspace";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type {
  WorkspaceMemberWithUser,
  ChannelMemberWithUser,
} from "@/types/workspace";

/**
 * Query key factory for member-related queries
 * Centralized query keys for better cache management
 */
export const memberKeys = {
  all: ["members"] as const,
  workspace: (workspaceId: string) =>
    [...memberKeys.all, "workspace", workspaceId] as const,
};

/**
 * Hook to fetch workspace members and channel members
 *
 * Fetches all members of a workspace including:
 * - Workspace members with enriched user info
 * - Channel members (for channels the user has access to)
 *
 * Data is cached for 2 minutes and automatically refetched when stale.
 *
 * @param workspaceId - The workspace ID to fetch members for (null to disable)
 * @returns React Query result with members data
 *
 * @example
 * ```tsx
 * function MembersList() {
 *   const { selectedWorkspaceId } = useWorkspaceStore();
 *   const { data, isLoading, error } = useWorkspaceMembers(selectedWorkspaceId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error loading members</div>;
 *
 *   const members = data?.data?.workspaceMembers || [];
 *   return <div>{members.length} members</div>;
 * }
 * ```
 */
export function useWorkspaceMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: memberKeys.workspace(workspaceId!),
    queryFn: () => getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * Selector hook for current channel members
 *
 * Automatically returns members for the currently selected channel
 * based on the workspace store state.
 *
 * @returns Array of channel members for the selected channel, or empty array
 *
 * @example
 * ```tsx
 * function ChannelMembersList() {
 *   const members = useCurrentChannelMembers();
 *   return <div>{members.length} channel members</div>;
 * }
 * ```
 */
export function useCurrentChannelMembers(): ChannelMemberWithUser[] {
  const { selectedWorkspaceId, selectedChannelId } = useWorkspaceStore();
  const { data } = useWorkspaceMembers(selectedWorkspaceId);

  return useMemo(() => {
    if (!data?.data || !selectedChannelId) return [];

    const channel = data.data.channels.find((c) => c.id === selectedChannelId);
    return channel?.members || [];
  }, [data, selectedChannelId]);
}

/**
 * Selector hook for current workspace members
 *
 * Automatically returns members for the currently selected workspace
 * based on the workspace store state.
 *
 * @returns Array of workspace members for the selected workspace, or empty array
 *
 * @example
 * ```tsx
 * function WorkspaceMembersList() {
 *   const members = useCurrentWorkspaceMembers();
 *   return <div>{members.length} workspace members</div>;
 * }
 * ```
 */
export function useCurrentWorkspaceMembers(): WorkspaceMemberWithUser[] {
  const { selectedWorkspaceId } = useWorkspaceStore();
  const { data } = useWorkspaceMembers(selectedWorkspaceId);

  return useMemo(() => {
    return data?.data?.workspaceMembers || [];
  }, [data]);
}

/**
 * Hook to get loading/error state for members
 *
 * Useful when you need to check the query state without the data.
 *
 * @returns Object with isLoading and error state
 */
export function useMembersQueryState() {
  const { selectedWorkspaceId } = useWorkspaceStore();
  const { isLoading, error, isFetching } =
    useWorkspaceMembers(selectedWorkspaceId);

  return { isLoading, error, isFetching };
}
