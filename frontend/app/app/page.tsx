"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppTopBar } from "@/components/app/app-topbar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppMainContent } from "@/components/app/app-main-content";
import { AppMembersSidebar } from "@/components/app/app-members-sidebar";
import { SuccessAlert } from "@/components/workspace/SuccessAlert";
import {
  useWorkspaceMemberships,
  workspaceKeys,
} from "@/lib/hooks/useWorkspaces";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  loadSelectedChannel,
  saveSelectedChannel,
} from "@/lib/utils/channelStorage";

/**
 * Inner app component that has access to query client
 * Separated to allow query invalidation on workspace creation
 */
function AppPageContent() {
  // Initialize workspace data fetching - syncs to Zustand store automatically
  useWorkspaceMemberships(true);

  const queryClient = useQueryClient();
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Set initial sidebar state based on screen size
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1024;
    setShowLeftSidebar(isDesktop);
    setShowRightSidebar(isDesktop);

    // Update sidebar state on window resize
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setShowLeftSidebar(isDesktop);
      setShowRightSidebar(isDesktop);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load selected channel from localStorage on mount
  useEffect(() => {
    const savedChannel = loadSelectedChannel();
    if (savedChannel) {
      setSelectedChannel(savedChannel);
    }
  }, []);

  // Save selected channel to localStorage when it changes
  const handleSelectChannel = (channelId: string | null) => {
    setSelectedChannel(channelId);
    saveSelectedChannel(channelId);
    // Close left sidebar on mobile when channel is selected
    if (window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };

  // Handle successful workspace creation
  const handleWorkspaceCreated = (workspaceId: string) => {
    // Invalidate workspace memberships query to refetch the data
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.memberships(),
    });

    setSuccessMessage("Workspace created successfully!");
    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Success Alert */}
      {successMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4">
          <SuccessAlert
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        </div>
      )}

      {/* Top Navigation Bar */}
      <AppTopBar
        selectedChannel={selectedChannel}
        showLeftSidebar={showLeftSidebar}
        showRightSidebar={showRightSidebar}
        onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
        onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
      />

      {/* Main Content Area with Sidebars */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Backdrop Overlay for Mobile - only show when sidebar is open on mobile */}
        {(showLeftSidebar || showRightSidebar) && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden top-14"
            onClick={() => {
              setShowLeftSidebar(false);
              setShowRightSidebar(false);
            }}
          />
        )}

        {/* Left Sidebar - Toggleable on all screen sizes */}
        <div
          className={`
            fixed lg:relative top-14 lg:top-0 left-0 h-[calc(100vh-3.5rem)] lg:h-full
            z-50 lg:z-auto transition-all duration-300 ease-in-out
            ${showLeftSidebar ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 w-64 lg:w-0"}
          `}
        >
          <AppSidebar
            collapsed={!showLeftSidebar}
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
            onWorkspaceCreated={handleWorkspaceCreated}
          />
        </div>

        {/* Main Content - Full width on mobile, flexible on desktop */}
        <div className="flex-1 w-full lg:w-auto">
          <AppMainContent selectedChannel={selectedChannel} />
        </div>

        {/* Right Sidebar - Toggleable on all screen sizes */}
        <div
          className={`
            fixed lg:relative top-14 lg:top-0 right-0 h-[calc(100vh-3.5rem)] lg:h-full
            z-50 lg:z-auto transition-all duration-300 ease-in-out
            ${showRightSidebar ? "translate-x-0 w-64" : "translate-x-full lg:translate-x-0 w-64 lg:w-0"}
          `}
        >
          <AppMembersSidebar
            collapsed={!showRightSidebar}
            selectedChannel={selectedChannel}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Main App Page Component
 * Wraps the app content with authentication guard
 */
export default function AppPage() {
  return (
    <AuthGuard>
      <AppPageContent />
    </AuthGuard>
  );
}
