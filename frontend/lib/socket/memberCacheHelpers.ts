/**
 * Shared helper functions for updating member cache
 * Used by both globalHandlers (immediate socket listeners) and useMemberSocket hook
 */

import type { MemberEventUserInfo } from "./types";
import type {
  WorkspaceMembersData,
  WorkspaceMemberWithUser,
  ChannelMemberWithUser,
  ChannelWithMembers,
  GetUserMembershipsResponse,
  ChannelCreatedEventPayload,
  ChannelMembershipResponse,
} from "@/types/workspace";
import { WorkspaceRole, ChannelRole, ChannelType } from "@/types/workspace";
import type { QueryClient } from "@tanstack/react-query";
import { memberKeys } from "@/lib/hooks/useMembers";
import { workspaceKeys } from "@/lib/hooks/useWorkspaces";

type CachedMembersResponse = { data: WorkspaceMembersData };

/**
 * Creates a new workspace member object from user info
 */
function createWorkspaceMember(
  userId: string,
  user: MemberEventUserInfo
): WorkspaceMemberWithUser {
  return {
    userId,
    role: WorkspaceRole.MEMBER,
    joinedAt: new Date().toISOString(),
    isActive: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lastSeen: user.lastSeen,
    },
  };
}

/**
 * Creates a new channel member object from user info
 */
function createChannelMember(
  userId: string,
  channelId: string,
  user: MemberEventUserInfo
): ChannelMemberWithUser {
  return {
    userId,
    channelId,
    role: ChannelRole.MEMBER,
    joinedAt: new Date().toISOString(),
    isActive: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lastSeen: user.lastSeen,
    },
  };
}

/**
 * Adds a new workspace member to the cache
 */
export function addWorkspaceMember(
  old: WorkspaceMembersData | undefined,
  userId: string,
  user: MemberEventUserInfo
): WorkspaceMembersData | undefined {
  if (!old) return old;

  // Check if member already exists
  const exists = old.workspaceMembers.some(
    (m: WorkspaceMemberWithUser) => m.userId === userId
  );
  if (exists) return old;

  const newMember = createWorkspaceMember(userId, user);

  return {
    ...old,
    workspaceMembers: [...old.workspaceMembers, newMember],
  };
}

/**
 * Removes a workspace member from the cache
 */
export function removeWorkspaceMember(
  old: WorkspaceMembersData | undefined,
  userId: string
): WorkspaceMembersData | undefined {
  if (!old) return old;

  return {
    ...old,
    workspaceMembers: old.workspaceMembers.filter(
      (m: WorkspaceMemberWithUser) => m.userId !== userId
    ),
    // Also remove from all channel member lists
    channels: old.channels.map((channel: ChannelWithMembers) => ({
      ...channel,
      members: channel.members.filter(
        (m: ChannelMemberWithUser) => m.userId !== userId
      ),
    })),
  };
}

/**
 * Adds a new channel member to the cache
 */
export function addChannelMember(
  old: WorkspaceMembersData | undefined,
  channelId: string,
  userId: string,
  user: MemberEventUserInfo
): WorkspaceMembersData | undefined {
  if (!old) return old;

  return {
    ...old,
    channels: old.channels.map((channel: ChannelWithMembers) => {
      if (channel.id !== channelId) return channel;

      // Check if member already exists in this channel
      const exists = channel.members.some(
        (m: ChannelMemberWithUser) => m.userId === userId
      );
      if (exists) return channel;

      const newMember = createChannelMember(userId, channelId, user);

      return {
        ...channel,
        members: [...channel.members, newMember],
      };
    }),
  };
}

/**
 * Removes a channel member from the cache
 */
export function removeChannelMember(
  old: WorkspaceMembersData | undefined,
  channelId: string,
  userId: string
): WorkspaceMembersData | undefined {
  if (!old) return old;

  return {
    ...old,
    channels: old.channels.map((channel: ChannelWithMembers) => {
      if (channel.id !== channelId) return channel;

      return {
        ...channel,
        members: channel.members.filter(
          (m: ChannelMemberWithUser) => m.userId !== userId
        ),
      };
    }),
  };
}

/**
 * Updates workspace member cache (add or remove)
 */
export function updateWorkspaceMemberCache(
  queryClient: QueryClient,
  workspaceId: string,
  userId: string,
  user: MemberEventUserInfo | null
): void {
  const cacheKey = memberKeys.workspace(workspaceId);

  queryClient.setQueryData<CachedMembersResponse>(cacheKey, (old) => {
    if (!old) return old;

    return {
      ...old,
      data: user
        ? addWorkspaceMember(old.data, userId, user)!
        : removeWorkspaceMember(old.data, userId)!,
    };
  });
}

/**
 * Updates channel member cache (add or remove)
 */
export function updateChannelMemberCache(
  queryClient: QueryClient,
  workspaceId: string,
  channelId: string,
  userId: string,
  user: MemberEventUserInfo | null
): void {
  const cacheKey = memberKeys.workspace(workspaceId);

  queryClient.setQueryData<CachedMembersResponse>(cacheKey, (old) => {
    if (!old) return old;

    return {
      ...old,
      data: user
        ? addChannelMember(old.data, channelId, userId, user)!
        : removeChannelMember(old.data, channelId, userId)!,
    };
  });
}

/**
 * Adds a new channel to the workspace members cache
 * Used when a channel:created event is received
 */
export function addNewChannelToCache(
  old: WorkspaceMembersData | undefined,
  eventPayload: ChannelCreatedEventPayload
): WorkspaceMembersData | undefined {
  if (!old) return old;

  // Check if channel already exists
  const exists = old.channels.some(
    (c: ChannelWithMembers) => c.id === eventPayload.channelId
  );
  if (exists) return old;

  // Convert event members to ChannelMemberWithUser format
  const channelMembers: ChannelMemberWithUser[] = eventPayload.members.map(
    (member) => ({
      userId: member.userId,
      channelId: eventPayload.channelId,
      role: member.role as ChannelRole,
      joinedAt: member.joinedAt,
      isActive: true,
      user: {
        id: member.userId,
        username: member.username,
        displayName: member.displayName ?? member.username, // Fallback to username if null
        email: "", // Not provided in event, but not critical
        avatarUrl: member.avatarUrl,
        lastSeen: null,
      },
    })
  );

  // Create new channel with members
  const newChannel: ChannelWithMembers = {
    id: eventPayload.channelId,
    name: eventPayload.channelName,
    displayName: eventPayload.channelDisplayName,
    type: eventPayload.isPrivate ? ChannelType.PRIVATE : ChannelType.PUBLIC,
    members: channelMembers,
  };

  return {
    ...old,
    channels: [...old.channels, newChannel],
  };
}

/**
 * Updates the members cache to add a newly created channel
 */
export function updateMembersCacheWithNewChannel(
  queryClient: QueryClient,
  workspaceId: string,
  eventPayload: ChannelCreatedEventPayload
): void {
  const cacheKey = memberKeys.workspace(workspaceId);

  queryClient.setQueryData<CachedMembersResponse>(cacheKey, (old) => {
    if (!old) return old;

    return {
      ...old,
      data: addNewChannelToCache(old.data, eventPayload)!,
    };
  });
}

/**
 * Updates the user memberships cache to add a new channel
 * Used for the sidebar channel list
 */
export function updateMembershipsCacheWithNewChannel(
  queryClient: QueryClient,
  eventPayload: ChannelCreatedEventPayload
): void {
  const cacheKey = workspaceKeys.membershipsWithChannels();

  queryClient.setQueryData<GetUserMembershipsResponse>(cacheKey, (old) => {
    if (!old?.data) return old;

    // Find the workspace and add the channel to it
    const updatedWorkspaces = old.data.workspaces.map((workspace) => {
      if (workspace.id !== eventPayload.workspaceId) return workspace;

      // Check if channel already exists
      const exists = workspace.channels?.some(
        (c) => c.id === eventPayload.channelId
      );
      if (exists) return workspace;

      // Add the new channel with full ChannelMembershipResponse structure
      const newChannel: ChannelMembershipResponse = {
        // Channel model fields
        id: eventPayload.channelId,
        workspaceId: eventPayload.workspaceId,
        name: eventPayload.channelName,
        displayName: eventPayload.channelDisplayName,
        description: eventPayload.channelDescription,
        type: eventPayload.isPrivate ? ChannelType.PRIVATE : ChannelType.PUBLIC,
        isArchived: false,
        isReadOnly: false,
        createdBy: eventPayload.createdBy,
        memberCount: eventPayload.members.length,
        lastActivity: null,
        settings: {},
        createdAt: eventPayload.createdAt,
        updatedAt: eventPayload.createdAt,
        // ChannelMember fields for current user (default values - will be refreshed on next query)
        role: ChannelRole.MEMBER,
        joinedAt: eventPayload.createdAt,
        isMuted: false,
        joinedBy: eventPayload.createdBy,
      };

      return {
        ...workspace,
        channels: [...(workspace.channels || []), newChannel],
      };
    });

    return {
      ...old,
      data: {
        ...old.data,
        workspaces: updatedWorkspaces,
      },
    };
  });
}
