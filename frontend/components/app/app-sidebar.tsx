"use client";

import {
  Building2,
  Hash,
  Plus,
  Circle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  MoreVertical,
  UserPlus,
  Settings,
  Lock,
} from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CreateWorkspaceModal } from "@/components/workspace/CreateWorkspaceModal";
import { InviteMembersModal } from "@/components/workspace/InviteMembersModal";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import {
  useWorkspaceMemberships,
  useRefetchMemberships,
  useSelectedWorkspace,
  workspaceKeys,
} from "@/lib/hooks/useWorkspaces";
import { memberKeys } from "@/lib/hooks/useMembers";
import { messageKeys } from "@/lib/hooks/useMessageQueries";
import { useQueryClient } from "@tanstack/react-query";
import { ChannelType, WorkspaceRole } from "@/types/workspace";

interface AppSidebarProps {
  collapsed: boolean;
  selectedChannel: string | null;
  onSelectChannel: (
    channelId: string | null,
    displayName?: string | null
  ) => void;
  onWorkspaceCreated?: (workspaceId: string) => void | Promise<void>;
  onChannelCreated?: (
    channelId: string,
    channelName?: string
  ) => void | Promise<void>;
}

export function AppSidebar({
  collapsed,
  selectedChannel,
  onSelectChannel,
  onWorkspaceCreated,
  onChannelCreated,
}: AppSidebarProps) {
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] =
    useState(false);
  const [showInviteMembersModal, setShowInviteMembersModal] = useState(false);
  const [selectedWorkspaceForInvite, setSelectedWorkspaceForInvite] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get workspace data from React Query
  const { data, isLoading, error } = useWorkspaceMemberships();
  const workspaces = data?.data?.workspaces || [];
  const queryClient = useQueryClient();

  // Get UI state from Zustand
  const selectedWorkspaceId = useWorkspaceStore(
    (state) => state.selectedWorkspaceId
  );
  const setSelectedWorkspace = useWorkspaceStore(
    (state) => state.setSelectedWorkspace
  );
  const getStoredChannelForWorkspace = useWorkspaceStore(
    (state) => state.getStoredChannelForWorkspace
  );
  const setMainPanelView = useWorkspaceStore((state) => state.setMainPanelView);

  // Get selected workspace (combines React Query + Zustand)
  const selectedWorkspace = useSelectedWorkspace();
  const refetchMemberships = useRefetchMemberships();

  // Get channels from the selected workspace only (public + private channels user is a member of)
  const channels =
    selectedWorkspace?.channels
      ?.filter(
        (channel) =>
          channel.type === ChannelType.PUBLIC ||
          channel.type === ChannelType.PRIVATE
      )
      .map((channel) => ({
        ...channel,
        workspaceId: selectedWorkspace.id,
        workspaceName: selectedWorkspace.displayName || selectedWorkspace.name,
      })) || [];

  // Handle workspace selection with channel restoration/auto-selection
  const handleSelectWorkspace = (workspaceId: string, displayName: string) => {
    // Update selected workspace
    setSelectedWorkspace(workspaceId, displayName);

    // Check if we have a stored channel selection for this workspace
    const storedChannel = getStoredChannelForWorkspace(workspaceId);

    if (storedChannel) {
      // Restore the previously selected channel
      onSelectChannel(storedChannel.channelId, storedChannel.displayName);
    } else {
      // First time selecting this workspace - find and select 'general' channel
      const workspace = workspaces.find((w) => w.id === workspaceId);
      const generalChannel = workspace?.channels?.find(
        (ch) =>
          ch.name.toLowerCase() === "general" && ch.type === ChannelType.PUBLIC
      );

      if (generalChannel) {
        onSelectChannel(
          generalChannel.id,
          generalChannel.displayName || generalChannel.name
        );
      } else {
        // No general channel, clear selection
        onSelectChannel(null);
      }
    }
  };

  // Check if user can create channels in the selected workspace
  const canCreateChannel =
    selectedWorkspace &&
    (selectedWorkspace.userRole === WorkspaceRole.OWNER ||
      selectedWorkspace.userRole === WorkspaceRole.ADMIN);

  // Handle refresh with visual feedback
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Invalidate all caches to force refetch
    await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    await queryClient.invalidateQueries({ queryKey: memberKeys.all });
    await queryClient.invalidateQueries({ queryKey: messageKeys.all });
    // Add small delay for better UX
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <TooltipProvider>
      <aside
        className={`w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full ${
          collapsed ? "hidden" : "block"
        }`}
      >
        {/* Workspace Header - Shows currently active workspace */}
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2 shrink-0">
          {selectedWorkspace ? (
            <>
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center font-bold text-lg text-primary-foreground">
                {(selectedWorkspace.displayName || selectedWorkspace.name)
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base text-sidebar-foreground truncate">
                  {selectedWorkspace.displayName || selectedWorkspace.name}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center font-bold text-lg text-primary-foreground">
                E
              </div>
              <div className="font-semibold text-lg text-sidebar-foreground">
                Echo
              </div>
            </>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Workspaces Section - List of all workspaces with add button */}
          <div className="py-4 border-b border-sidebar-border">
            <div className="px-4 pb-2 flex items-center justify-between">
              <button
                onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
                aria-label="Toggle workspaces section"
              >
                {workspacesExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Workspaces
              </button>
              {/* Add Workspace and Refresh Buttons */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Refresh Workspaces"
                      onClick={handleRefresh}
                      disabled={isRefreshing || isLoading}
                      className="text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRefreshing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh Workspaces</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Add Workspace"
                      onClick={() => setShowCreateWorkspaceModal(true)}
                      className="text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Workspace</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {/* Workspace List */}
            {workspacesExpanded && (
              <nav className="max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="px-4 py-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="px-4 py-2 text-sm text-destructive">
                    Failed to load workspaces
                  </div>
                ) : workspaces.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      No workspaces yet
                    </p>
                    <button
                      onClick={() => setShowCreateWorkspaceModal(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Create your first workspace
                    </button>
                  </div>
                ) : (
                  workspaces.map((workspace) => {
                    const canInvite =
                      workspace.userRole === WorkspaceRole.OWNER ||
                      workspace.userRole === WorkspaceRole.ADMIN;

                    return (
                      <Tooltip key={workspace.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`group w-full flex items-center gap-1 text-sm ${
                              selectedWorkspaceId === workspace.id
                                ? "bg-sidebar-accent/50 border-l-2 border-primary"
                                : "hover:bg-sidebar-accent"
                            }`}
                          >
                            <button
                              onClick={() =>
                                handleSelectWorkspace(
                                  workspace.id,
                                  workspace.displayName || workspace.name
                                )
                              }
                              className="flex-1 px-4 py-2 flex items-center gap-2 text-sidebar-foreground transition-colors text-sm"
                            >
                              <Building2 className="w-5 h-5 flex-shrink-0" />
                              <span className="truncate flex-1 text-left">
                                {workspace.displayName || workspace.name}
                              </span>
                            </button>

                            {/* Workspace Settings Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-1 mr-2 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded transition-all"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Workspace options"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-56 bg-dropdown text-dropdown-foreground"
                              >
                                {canInvite && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedWorkspaceForInvite({
                                          id: workspace.id,
                                          name:
                                            workspace.displayName ||
                                            workspace.name,
                                        });
                                        setShowInviteMembersModal(true);
                                      }}
                                    >
                                      <UserPlus className="mr-2 h-4 w-4" />
                                      Invite Members
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem disabled>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Workspace Settings
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="text-left">
                            <p className="font-semibold">
                              {workspace.displayName || workspace.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {workspace.userRole}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                )}
              </nav>
            )}
          </div>

          {/* Channels Section - Shows channels from the selected workspace */}
          <div className="py-4 border-b border-sidebar-border">
            <div className="px-4 pb-2 flex items-center justify-between">
              <button
                onClick={() => setChannelsExpanded(!channelsExpanded)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
                aria-label="Toggle channels section"
              >
                {channelsExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Channels
                {selectedWorkspace && channels.length > 0 && (
                  <span className="ml-1 text-xs">({channels.length})</span>
                )}
              </button>
              {/* Add Channel Button - only show if user has permission */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add Channel"
                    disabled={!canCreateChannel}
                    onClick={() => setMainPanelView("create-channel")}
                    className="text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {canCreateChannel
                      ? "Add Channel"
                      : "Only workspace owners and admins can create channels"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            {/* Channel List */}
            {channelsExpanded && (
              <nav className="max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="px-4 py-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !selectedWorkspace ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No workspace selected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Select a workspace to view channels
                    </p>
                  </div>
                ) : channels.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No channels yet
                    </p>
                    {canCreateChannel && (
                      <p className="text-xs text-muted-foreground">
                        Create a channel to get started
                      </p>
                    )}
                  </div>
                ) : (
                  channels.map((channel) => (
                    <Tooltip key={channel.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() =>
                            onSelectChannel(
                              channel.id,
                              channel.displayName || channel.name
                            )
                          }
                          className={`w-full px-4 py-2 flex items-center gap-2 text-sidebar-foreground transition-colors text-sm relative ${
                            selectedChannel === channel.id
                              ? "bg-sidebar-accent/50 border-l-2 border-primary"
                              : "hover:bg-sidebar-accent"
                          }`}
                        >
                          {channel.type === ChannelType.PRIVATE ? (
                            <Lock className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <Hash className="w-5 h-5 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1 text-left">
                            {channel.name}
                          </span>
                          {/* No unread counts for now */}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="text-left">
                          <p className="font-semibold">#{channel.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {channel.workspaceName}
                          </p>
                          {channel.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {channel.description}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))
                )}
              </nav>
            )}
          </div>

          {/* Direct Messages Section - Hidden for now as per user requirements */}
          {/* Will be implemented in a future user story */}
        </div>
      </aside>

      {/* Create Workspace Modal - Opens when + button is clicked in Workspaces section */}
      <CreateWorkspaceModal
        open={showCreateWorkspaceModal}
        onOpenChange={setShowCreateWorkspaceModal}
        onSuccess={async (workspaceId) => {
          setShowCreateWorkspaceModal(false);
          await onWorkspaceCreated?.(workspaceId);
        }}
      />

      {/* Invite Members Modal - Opens when Invite Members is clicked from workspace menu */}
      {selectedWorkspaceForInvite && (
        <InviteMembersModal
          open={showInviteMembersModal}
          onOpenChange={setShowInviteMembersModal}
          workspaceId={selectedWorkspaceForInvite.id}
          workspaceName={selectedWorkspaceForInvite.name}
        />
      )}
    </TooltipProvider>
  );
}
