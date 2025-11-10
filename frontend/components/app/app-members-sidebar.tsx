"use client";

import { Circle } from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppMembersSidebarProps {
  collapsed: boolean;
  selectedChannel: string | null;
}

export function AppMembersSidebar({
  collapsed,
  selectedChannel,
}: AppMembersSidebarProps) {
  const [showWorkspaceMembers, setShowWorkspaceMembers] = useState(false);

  // Mock data - will be replaced with real data later
  const channelMembers = [
    {
      id: "1",
      name: "Alex Johnson",
      avatar: "AJ",
      role: "Product Designer",
      status: "online",
    },
    {
      id: "2",
      name: "Sam Rivera",
      avatar: "SR",
      role: "Frontend Developer",
      status: "away",
    },
    {
      id: "3",
      name: "Taylor Kim",
      avatar: "TK",
      role: "Backend Developer",
      status: "online",
    },
    {
      id: "4",
      name: "Jordan Smith",
      avatar: "JS",
      role: "Marketing Manager",
      status: "busy",
    },
    {
      id: "5",
      name: "John Doe",
      avatar: "JD",
      role: "Project Manager",
      status: "online",
    },
  ];

  const workspaceMembers = [
    ...channelMembers,
    {
      id: "6",
      name: "Pat Brown",
      avatar: "PB",
      role: "Designer",
      status: "offline",
    },
    {
      id: "7",
      name: "Chris Lee",
      avatar: "CL",
      role: "Developer",
      status: "offline",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "text-green-500";
      case "away":
        return "text-yellow-500";
      case "busy":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const members = showWorkspaceMembers ? workspaceMembers : channelMembers;

  // Hide sidebar when no channel is selected
  if (!selectedChannel) {
    return null;
  }

  return (
    <TooltipProvider>
      <aside
        className={`w-64 bg-sidebar border-l border-sidebar-border flex flex-col h-full overflow-hidden ${
          collapsed ? "hidden" : "block"
        }`}
      >
        {/* Header with toggle */}
        <div className="p-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sidebar-foreground">
              {showWorkspaceMembers ? "Workspace Members" : "Channel Members"}
            </h2>
            <span className="text-xs text-muted-foreground">
              {members.length}
            </span>
          </div>
          <button
            onClick={() => setShowWorkspaceMembers(!showWorkspaceMembers)}
            className="w-full text-xs text-primary hover:text-primary/80 transition-colors text-left"
          >
            {showWorkspaceMembers
              ? "Show Channel Members"
              : "Show All Workspace Members"}
          </button>
        </div>

        {/* Members List - Scrollable */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {members.map((member) => (
            <Tooltip key={member.id}>
              <TooltipTrigger asChild>
                <button className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sidebar-accent transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-primary flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-medium text-sm text-sidebar-foreground truncate">
                      {member.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {member.role}
                    </div>
                  </div>
                  <Circle
                    className={`w-2 h-2 flex-shrink-0 fill-current ${getStatusColor(
                      member.status
                    )}`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>
                  {member.name} - {member.status}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </aside>
    </TooltipProvider>
  );
}
