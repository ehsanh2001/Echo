/**
 * Workspace Context Provider
 *
 * Provides workspace memberships data to the entire app using React Context.
 * Wraps the useWorkspaceMemberships React Query hook and exposes data,
 * loading states, and refetch function to child components.
 */

"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useWorkspaceMemberships } from "@/lib/hooks/useWorkspaces";
import type {
  WorkspaceMembershipResponse,
  GetUserMembershipsResponse,
} from "@/types/workspace";

/**
 * Shape of the workspace context value
 */
interface WorkspaceContextValue {
  /** Array of workspaces the user belongs to (with channels if included) */
  workspaces: WorkspaceMembershipResponse[];
  /** Whether workspace data is currently being fetched */
  isLoading: boolean;
  /** Error object if workspace fetch failed */
  error: Error | null;
  /** Function to manually refetch workspace memberships */
  refetch: () => void;
  /** Full response data from the API (includes success, timestamp, etc.) */
  fullData: GetUserMembershipsResponse | undefined;
}

/**
 * Context for workspace data
 * Use useWorkspaceContext() to access this context
 */
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

/**
 * Props for WorkspaceProvider component
 */
interface WorkspaceProviderProps {
  /** Child components that will have access to workspace context */
  children: ReactNode;
}

/**
 * Workspace Provider Component
 *
 * Wraps the app to provide workspace memberships data to all child components.
 * Automatically fetches workspace data on mount and keeps it in sync.
 *
 * @example
 * ```tsx
 * // In app layout or page
 * export default function AppPage() {
 *   return (
 *     <WorkspaceProvider>
 *       <AppSidebar />
 *       <AppMainContent />
 *     </WorkspaceProvider>
 *   );
 * }
 * ```
 */
export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  // Fetch workspace memberships with channels included
  const { data, isLoading, error, refetch } = useWorkspaceMemberships(true);

  // Extract workspaces array from response, default to empty array
  const workspaces = data?.data?.workspaces || [];

  // Build context value
  const value: WorkspaceContextValue = {
    workspaces,
    isLoading,
    error: error as Error | null,
    refetch,
    fullData: data,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 *
 * Must be used within a WorkspaceProvider component.
 * Provides access to workspace memberships data, loading states, and refetch function.
 *
 * @throws Error if used outside of WorkspaceProvider
 *
 * @example
 * ```tsx
 * function WorkspaceList() {
 *   const { workspaces, isLoading, error, refetch } = useWorkspaceContext();
 *
 *   if (isLoading) return <div>Loading workspaces...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={() => refetch()}>Refresh</button>
 *       {workspaces.map(workspace => (
 *         <div key={workspace.id}>
 *           {workspace.displayName || workspace.name}
 *           <span>Role: {workspace.userRole}</span>
 *           <span>Members: {workspace.memberCount}</span>
 *           {workspace.channels?.map(channel => (
 *             <div key={channel.id}>{channel.name}</div>
 *           ))}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error(
      "useWorkspaceContext must be used within a WorkspaceProvider. " +
        "Make sure your component is wrapped with <WorkspaceProvider>."
    );
  }

  return context;
}
