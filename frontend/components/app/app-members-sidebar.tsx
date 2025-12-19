"use client";

import { useMemo } from "react";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemberListItem } from "./member-list-item";
import { useWorkspaceMembers } from "@/lib/hooks/useMembers";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

interface AppMembersSidebarProps {
  collapsed: boolean;
  selectedChannel: string | null;
}

export function AppMembersSidebar({
  collapsed,
  selectedChannel,
}: AppMembersSidebarProps) {
  const {
    selectedWorkspaceId,
    selectedWorkspaceDisplayName,
    selectedChannelDisplayName,
    showWorkspaceMembers,
    toggleMembersView,
  } = useWorkspaceStore();

  const { data, isLoading, error } = useWorkspaceMembers(selectedWorkspaceId);

  // Get workspace members
  const workspaceMembers = useMemo(() => {
    return data?.data?.workspaceMembers || [];
  }, [data]);

  // Get channel members for selected channel
  const channelMembers = useMemo(() => {
    if (!selectedChannel || !data?.data?.channels) return [];
    const channel = data.data.channels.find((c) => c.id === selectedChannel);
    return channel?.members || [];
  }, [selectedChannel, data]);

  // Get channel name for display
  const selectedChannelName = useMemo(() => {
    if (!selectedChannel || !data?.data?.channels)
      return selectedChannelDisplayName;
    const channel = data.data.channels.find((c) => c.id === selectedChannel);
    return channel?.displayName || channel?.name || selectedChannelDisplayName;
  }, [selectedChannel, data, selectedChannelDisplayName]);

  // Determine which members to show
  // If no channel is selected, always show workspace members
  const effectiveShowWorkspaceMembers =
    !selectedChannel || showWorkspaceMembers;
  const members = effectiveShowWorkspaceMembers
    ? workspaceMembers
    : channelMembers;

  // Hide sidebar when collapsed
  if (collapsed) {
    return null;
  }

  return (
    <TooltipProvider>
      <aside className="w-64 bg-sidebar border-l border-sidebar-border flex flex-col h-full overflow-hidden">
        {/* Header - Shows member count and toggle button */}
        <div className="p-4 border-b border-sidebar-border shrink-0">
          {/* Member Count Header */}
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-sidebar-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              {effectiveShowWorkspaceMembers ? "Workspace" : "Channel"}
            </h2>
            {!isLoading && !error && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {members.length}
              </span>
            )}
          </div>

          {/* Show workspace or channel name */}
          <p className="text-sm text-muted-foreground truncate mb-2">
            {effectiveShowWorkspaceMembers
              ? selectedWorkspaceDisplayName || "No workspace selected"
              : `#${selectedChannelName || "No channel selected"}`}
          </p>

          {/* Toggle Between Channel and Workspace Members Button */}
          {selectedChannel && (
            <button
              onClick={toggleMembersView}
              className="w-full text-xs text-primary hover:text-primary/80 transition-colors text-left"
              aria-label={
                showWorkspaceMembers
                  ? "Show channel members only"
                  : "Show all workspace members"
              }
            >
              {showWorkspaceMembers
                ? "← Show Channel Members"
                : "Show All Workspace Members →"}
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">
              Failed to load members
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && members.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <Users className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No members found</p>
          </div>
        )}

        {/* Members List - Scrollable list of team members */}
        {!isLoading && !error && members.length > 0 && (
          <div className="flex-1 overflow-y-auto py-2 min-h-0">
            {members.map((member) => (
              <MemberListItem key={member.userId} member={member} />
            ))}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
