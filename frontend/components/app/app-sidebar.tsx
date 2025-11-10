"use client";

import {
  Building2,
  Hash,
  Plus,
  Circle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppSidebarProps {
  collapsed: boolean;
  selectedChannel: string | null;
  onSelectChannel: (channel: string | null) => void;
}

export function AppSidebar({
  collapsed,
  selectedChannel,
  onSelectChannel,
}: AppSidebarProps) {
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);

  // Mock data - will be replaced with real data later
  const workspaces = [
    { id: "1", name: "Design Team", icon: "D" },
    { id: "2", name: "Dev Team", icon: "DT" },
    { id: "3", name: "Marketing", icon: "M" },
  ];

  const channels = [
    { id: "general", name: "general", unread: 0 },
    { id: "design", name: "design", unread: 3 },
    { id: "development", name: "development", unread: 0 },
    { id: "marketing", name: "marketing", unread: 0 },
    { id: "random", name: "random", unread: 0 },
  ];

  const directMessages = [
    { id: "dm1", name: "Alex Johnson", status: "online", unread: 0 },
    { id: "dm2", name: "Sam Rivera", status: "away", unread: 1 },
    { id: "dm3", name: "Taylor Kim", status: "online", unread: 0 },
    { id: "dm4", name: "Jordan Smith", status: "busy", unread: 0 },
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

  return (
    <TooltipProvider>
      <aside
        className={`w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full ${
          collapsed ? "hidden" : "block"
        }`}
      >
        {/* Workspace Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center font-bold text-lg text-primary-foreground">
            C
          </div>
          <div className="font-semibold text-lg text-sidebar-foreground">
            ConnectHub
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Workspaces Section */}
          <div className="py-4 border-b border-sidebar-border">
            <div className="px-4 pb-2 flex items-center justify-between">
              <button
                onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
              >
                {workspacesExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Workspaces
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add Workspace</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {workspacesExpanded && (
              <nav className="max-h-48 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <Tooltip key={workspace.id}>
                    <TooltipTrigger asChild>
                      <button className="w-full px-4 py-2 flex items-center gap-2 hover:bg-sidebar-accent text-sidebar-foreground transition-colors text-sm">
                        <Building2 className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate">{workspace.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{workspace.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </nav>
            )}
          </div>

          {/* Channels Section */}
          <div className="py-4 border-b border-sidebar-border">
            <div className="px-4 pb-2 flex items-center justify-between">
              <button
                onClick={() => setChannelsExpanded(!channelsExpanded)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
              >
                {channelsExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Channels
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add Channel</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {channelsExpanded && (
              <nav className="max-h-48 overflow-y-auto">
                {channels.map((channel) => (
                  <Tooltip key={channel.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelectChannel(channel.id)}
                        className={`w-full px-4 py-2 flex items-center gap-2 text-sidebar-foreground transition-colors text-sm relative ${
                          selectedChannel === channel.id
                            ? "bg-sidebar-accent/50 border-l-2 border-primary"
                            : "hover:bg-sidebar-accent"
                        }`}
                      >
                        <Hash className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate flex-1 text-left">
                          {channel.name}
                        </span>
                        {channel.unread > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                            {channel.unread}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>#{channel.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </nav>
            )}
          </div>

          {/* Direct Messages Section */}
          <div className="py-4 border-b border-sidebar-border">
            <div className="px-4 pb-2 flex items-center justify-between">
              <button
                onClick={() => setDmsExpanded(!dmsExpanded)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
              >
                {dmsExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Direct Messages
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start Direct Message</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {dmsExpanded && (
              <nav className="max-h-48 overflow-y-auto">
                {directMessages.map((dm) => (
                  <Tooltip key={dm.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelectChannel(dm.id)}
                        className={`w-full px-4 py-2 flex items-center gap-2 text-sidebar-foreground transition-colors text-sm relative ${
                          selectedChannel === dm.id
                            ? "bg-sidebar-accent/50 border-l-2 border-primary"
                            : "hover:bg-sidebar-accent"
                        }`}
                      >
                        <Circle
                          className={`w-2 h-2 flex-shrink-0 fill-current ${getStatusColor(
                            dm.status
                          )}`}
                        />
                        <span className="truncate flex-1 text-left">
                          {dm.name}
                        </span>
                        {dm.unread > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                            {dm.unread}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{dm.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </nav>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
