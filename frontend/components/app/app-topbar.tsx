"use client";

import {
  Menu,
  Users,
  Moon,
  Sun,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useCurrentUser } from "@/lib/stores/user-store";
import { useLogout } from "@/lib/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppTopBarProps {
  selectedChannel: string | null;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
}

export function AppTopBar({
  selectedChannel,
  showLeftSidebar,
  showRightSidebar,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: AppTopBarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const logoutMutation = useLogout();
  const currentUser = useCurrentUser();

  // Get workspace and channel display names from Zustand store
  const selectedWorkspaceDisplayName = useWorkspaceStore(
    (state) => state.selectedWorkspaceDisplayName,
  );
  const selectedChannelDisplayName = useWorkspaceStore(
    (state) => state.selectedChannelDisplayName,
  );

  // Get avatar initials from display name or username
  const getInitials = (displayName?: string, username?: string): string => {
    const name = displayName || username || "User";
    const parts = name.trim().split(/\s+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
  };

  const avatarInitials = getInitials(
    currentUser?.displayName,
    currentUser?.username,
  );

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Left Sidebar Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleLeftSidebar}
                className="p-2 hover:bg-accent rounded-md transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{showLeftSidebar ? "Hide" : "Show"} sidebar</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Channel/Workspace Title */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">
            {selectedChannel && selectedChannelDisplayName ? (
              <>
                <span className="text-muted-foreground">
                  {selectedWorkspaceDisplayName || "Workspace"}
                </span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span># {selectedChannelDisplayName}</span>
              </>
            ) : (
              selectedWorkspaceDisplayName || "My Workspace"
            )}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Right Sidebar Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleRightSidebar}
                className="p-2 hover:bg-accent rounded-md transition-colors"
                aria-label="Toggle members sidebar"
              >
                <Users className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{showRightSidebar ? "Hide" : "Show"} members</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Theme Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 hover:bg-accent rounded-md transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle theme</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-2 hover:bg-accent rounded-md transition-colors">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-to-br from-primary to-primary/70 text-white"
                title={
                  currentUser?.displayName || currentUser?.username || "User"
                }
              >
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={
                      currentUser.displayName || currentUser.username || "User"
                    }
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  avatarInitials
                )}
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-semibold">
              {currentUser?.displayName || currentUser?.username || "User"}
            </div>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {currentUser?.email || ""}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
