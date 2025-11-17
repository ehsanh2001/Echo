"use client";

import { Star, UserPlus, Info, Smile, Paperclip, Send } from "lucide-react";
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

interface AppMainContentProps {
  selectedChannel: string | null;
}

export function AppMainContent({ selectedChannel }: AppMainContentProps) {
  const { data } = useWorkspaceMemberships();
  const workspaces = data?.data?.workspaces || [];
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] =
    useState(false);

  // Mock data - will be replaced with real data later
  const messages = [
    {
      id: "1",
      sender: "Alex Johnson",
      avatar: "AJ",
      time: "10:15 AM",
      text: "Hey team! Just wanted to share the latest design mockups for the new dashboard. Let me know what you think!",
      isOwn: false,
    },
    {
      id: "2",
      sender: "Sam Rivera",
      avatar: "SR",
      time: "10:22 AM",
      text: "The designs look great! I especially like the new data visualization components.",
      isOwn: false,
    },
    {
      id: "3",
      sender: "You",
      avatar: "JD",
      time: "10:25 AM",
      text: "Agreed! The color scheme is much better than the previous version. When can we expect to start implementation?",
      isOwn: true,
    },
    {
      id: "4",
      sender: "Alex Johnson",
      avatar: "AJ",
      time: "10:30 AM",
      text: "I'm finishing up the final details today. We should be able to start tomorrow morning.",
      isOwn: false,
    },
  ];

  // Empty state when no channel is selected
  if (!selectedChannel) {
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
                # {selectedChannel}
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

        {/* Messages Container - Scrollable message history */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 max-w-[80%] ${
                message.isOwn ? "ml-auto flex-row-reverse" : ""
              }`}
            >
              {/* User Avatar */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  message.isOwn
                    ? "bg-gradient-to-br from-yellow-500 to-red-500"
                    : "bg-gradient-to-br from-primary to-primary/70"
                } text-white`}
              >
                {message.avatar}
              </div>
              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {/* Sender Name and Timestamp */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">
                    {message.sender}
                  </span>
                  <span
                    className={`text-xs ${
                      message.isOwn
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {message.time}
                  </span>
                </div>
                {/* Message Text */}
                <p className="text-sm leading-relaxed">{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input - Compose and send new messages */}
        <div className="p-5 border-t border-border shrink-0">
          <div className="flex items-center gap-3 bg-muted rounded-3xl px-4 py-3">
            {/* Emoji Picker Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1 transition-colors"
                  aria-label="Add emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Emoji</p>
              </TooltipContent>
            </Tooltip>
            {/* Message Input Field */}
            <input
              type="text"
              placeholder="Message #general"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            {/* Attach File Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1 transition-colors"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Attach File</p>
              </TooltipContent>
            </Tooltip>
            {/* Send Message Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send Message</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
