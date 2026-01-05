"use client";

import { Star, UserPlus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaceMemberships } from "@/lib/hooks/useWorkspaces";
import { useState } from "react";
import { CreateWorkspaceModal } from "@/components/workspace/CreateWorkspaceModal";
import { CreateChannelPanel } from "@/components/channel/CreateChannelPanel";
import { MessageInput } from "@/components/message/MessageInput";
import { MessageList } from "@/components/message/MessageList";

interface AppMainContentProps {
  selectedChannelId: string | null;
}

export function AppMainContent({ selectedChannelId }: AppMainContentProps) {
  const { data } = useWorkspaceMemberships();
  const workspaces = data?.data?.workspaces || [];
  const selectedWorkspaceId = useWorkspaceStore(
    (state) => state.selectedWorkspaceId
  );
  const selectedChannelDisplayName = useWorkspaceStore(
    (state) => state.selectedChannelDisplayName
  );
  const mainPanelView = useWorkspaceStore((state) => state.mainPanelView);
  const setMainPanelView = useWorkspaceStore((state) => state.setMainPanelView);
  const setSelectedChannel = useWorkspaceStore(
    (state) => state.setSelectedChannel
  );
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] =
    useState(false);

  // Handle channel creation success
  const handleChannelCreated = (channelId: string, channelName: string) => {
    // Select the newly created channel
    setSelectedChannel(channelId, channelName);
    // Return to messages view
    setMainPanelView("messages");
  };

  // Handle cancel create channel
  const handleCancelCreateChannel = () => {
    setMainPanelView("messages");
  };

  // Show Create Channel Panel
  if (mainPanelView === "create-channel" && selectedWorkspaceId) {
    return (
      <CreateChannelPanel
        workspaceId={selectedWorkspaceId}
        onSuccess={handleChannelCreated}
        onCancel={handleCancelCreateChannel}
      />
    );
  }

  // Empty state when no channel is selected
  if (!selectedChannelId) {
    // Distinguish between "no workspaces" and "no channel selected"
    const hasNoWorkspaces = workspaces.length === 0;

    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          {hasNoWorkspaces ? (
            <>
              {/* No workspaces state */}
              <h2 className="text-2xl font-bold text-foreground">
                Welcome to Echo!
              </h2>
              <p className="text-muted-foreground">
                You're not a member of any workspace yet.
              </p>
              <p className="text-muted-foreground">
                Create your first workspace to start collaborating with your
                team.
              </p>
              <button
                onClick={() => setShowCreateWorkspaceModal(true)}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                Create Workspace
              </button>
            </>
          ) : (
            <>
              {/* No channel selected state */}
              <h2 className="text-2xl font-bold text-foreground">
                Welcome to Echo!
              </h2>
              <div className="space-y-2 text-muted-foreground">
                <p>Get started by:</p>
                <ul className="text-left space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Selecting a channel from the sidebar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Creating a new channel for your team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Inviting team members to collaborate</span>
                  </li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                Select a channel from the sidebar to start messaging
              </p>
            </>
          )}
        </div>

        {/* Create Workspace Modal */}
        <CreateWorkspaceModal
          open={showCreateWorkspaceModal}
          onOpenChange={setShowCreateWorkspaceModal}
          onSuccess={(workspaceId) => {
            setShowCreateWorkspaceModal(false);
            // Parent component will show success message
          }}
        />
      </main>
    );
  }

  return (
    <TooltipProvider>
      <main className="flex-1 flex flex-col bg-background h-full overflow-hidden">
        {/* Channel Header - Shows channel name and action buttons */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Channel Name and Description */}
            <div>
              <h1 className="font-semibold text-lg text-foreground">
                # {selectedChannelDisplayName || selectedChannelId}
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                For team-wide communication and announcements
              </p>
            </div>
          </div>
          {/* Channel Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Star Channel Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors"
                  aria-label="Star channel"
                >
                  <Star className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Star Channel</p>
              </TooltipContent>
            </Tooltip>
            {/* Invite Members Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors"
                  aria-label="Invite members to channel"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Invite Members</p>
              </TooltipContent>
            </Tooltip>
            {/* Channel Info Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors"
                  aria-label="Show channel information"
                >
                  <Info className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Channel Info</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Messages List - Real-time message display with infinite scroll */}
        {selectedWorkspaceId && selectedChannelId && (
          <MessageList
            workspaceId={selectedWorkspaceId}
            channelId={selectedChannelId}
          />
        )}

        {/* Message Input - Compose and send new messages */}
        {selectedWorkspaceId && selectedChannelId && (
          <MessageInput
            workspaceId={selectedWorkspaceId}
            channelId={selectedChannelId}
            channelName={selectedChannelDisplayName || selectedChannelId}
            onMessageSent={(messageId) => {
              console.log("Message sent:", messageId);
              // Will scroll to bottom when we implement message list
            }}
          />
        )}
      </main>
    </TooltipProvider>
  );
}
