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

  // Get workspace and channel display names from Zustand store
  const selectedWorkspaceDisplayName = useWorkspaceStore(
    (state) => state.selectedWorkspaceDisplayName
  );
  const selectedChannelDisplayName = useWorkspaceStore(
    (state) => state.selectedChannelDisplayName
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    router.push("/login");
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
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                JD
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-semibold">John Doe</div>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              john.doe@example.com
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
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
