"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppTopBar } from "@/components/app/app-topbar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppMainContent } from "@/components/app/app-main-content";
import { AppMembersSidebar } from "@/components/app/app-members-sidebar";
import { WelcomeModal } from "@/components/invite/WelcomeModal";
import { ErrorModal } from "@/components/invite/ErrorModal";
import {
  useWorkspaceMemberships,
  workspaceKeys,
} from "@/lib/hooks/useWorkspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaceRooms } from "@/lib/hooks/useWorkspaceRooms";
import { useMessageSocket } from "@/lib/hooks/useMessageSocket";
import { useMemberSocket } from "@/lib/hooks/useMemberSocket";
import { useChannelSocket } from "@/lib/hooks/useChannelSocket";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

/**
 * Inner app component that has access to query client
 * Separated to allow query invalidation on workspace creation
 */
function AppPageContent() {
  // Initialize workspace data fetching - syncs to Zustand store automatically
  const workspaceMembershipsQuery = useWorkspaceMemberships(true);
  const workspaces = workspaceMembershipsQuery.data?.data?.workspaces;

  // Join all workspace and channel rooms via Socket.IO
  useWorkspaceRooms({ workspaces });

  // Listen to Socket.IO message events and update React Query cache
  useMessageSocket();

  // Listen to Socket.IO member events and update React Query cache
  useMemberSocket();

  // Listen to Socket.IO channel events (new channel created)
  useChannelSocket();

  const queryClient = useQueryClient();
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Invite modals state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeData, setWelcomeData] = useState<{
    workspaceName: string;
    channelCount: number;
  } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Get channel selection from Zustand store
  const selectedChannelId = useWorkspaceStore(
    (state) => state.selectedChannelId
  );
  const setSelectedChannel = useWorkspaceStore(
    (state) => state.setSelectedChannel
  );

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

  // Check for invite success/error on mount
  useEffect(() => {
    const inviteSuccess = localStorage.getItem("invite_success");
    const inviteError = localStorage.getItem("invite_error");

    if (inviteSuccess) {
      try {
        const data = JSON.parse(inviteSuccess);
        setWelcomeData(data);
        setShowWelcomeModal(true);
        localStorage.removeItem("invite_success");
      } catch (error) {
        console.error("Failed to parse invite success data:", error);
      }
    }

    if (inviteError) {
      try {
        const data = JSON.parse(inviteError);
        setErrorMessage(data.message);
        setShowErrorModal(true);
        localStorage.removeItem("invite_error");
      } catch (error) {
        console.error("Failed to parse invite error data:", error);
      }
    }
  }, []);

  // Handle channel selection
  const handleSelectChannel = (
    channelId: string | null,
    displayName?: string | null
  ) => {
    setSelectedChannel(channelId, displayName);
    // Close left sidebar on mobile when channel is selected
    if (window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };

  // Handle successful workspace creation
  const handleWorkspaceCreated = async (workspaceId: string) => {
    // Force refetch workspace memberships to show new workspace immediately
    await queryClient.refetchQueries({
      queryKey: workspaceKeys.membershipsWithChannels(),
    });

    // setSuccessMessage("Workspace created successfully!");
    // // Auto-hide success message after 5 seconds
    // setTimeout(() => {
    //   setSuccessMessage(null);
    // }, 5000);
  };

  // Handle successful channel creation
  const handleChannelCreated = async (
    channelId: string,
    channelName?: string
  ) => {
    // Force refetch workspace memberships to show new channel immediately
    await queryClient.refetchQueries({
      queryKey: workspaceKeys.membershipsWithChannels(),
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Welcome Modal */}
      {welcomeData && (
        <WelcomeModal
          open={showWelcomeModal}
          onClose={() => setShowWelcomeModal(false)}
          workspaceName={welcomeData.workspaceName}
          channelCount={welcomeData.channelCount}
        />
      )}

      {/* Error Modal */}
      <ErrorModal
        open={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
      />

      {/* Top Navigation Bar */}
      <AppTopBar
        selectedChannel={selectedChannelId}
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
            selectedChannel={selectedChannelId}
            onSelectChannel={handleSelectChannel}
            onWorkspaceCreated={handleWorkspaceCreated}
            onChannelCreated={handleChannelCreated}
          />
        </div>

        {/* Main Content - Full width on mobile, flexible on desktop */}
        <div className="flex-1 w-full lg:w-auto">
          <AppMainContent selectedChannelId={selectedChannelId} />
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
            selectedChannel={selectedChannelId}
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
