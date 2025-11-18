/**
 * Workspace Store using Zustand
 *
 * Stores ONLY client-side UI state for workspaces.
 * Server state (workspace data, channels) is managed by React Query cache.
 *
 * This store should only contain UI state that is NOT derived from server data:
 * - Which workspace is currently selected (client-side navigation state)
 * - UI preferences, filters, etc. (future)
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  /** ID of the currently selected workspace (client-side UI state) */
  selectedWorkspaceId: string | null;

  /** Display name of the currently selected workspace (for UI display) */
  selectedWorkspaceDisplayName: string | null;

  /** ID of the currently selected channel (client-side UI state) */
  selectedChannelId: string | null;

  /** Display name of the currently selected channel (for UI display) */
  selectedChannelDisplayName: string | null;

  // Actions
  setSelectedWorkspace: (
    workspaceId: string | null,
    displayName?: string | null
  ) => void;
  setSelectedChannel: (
    channelId: string | null,
    displayName?: string | null
  ) => void;
  clearSelectedChannel: () => void;
}

/**
 * Zustand store for workspace UI state
 *
 * Provides ONLY client-side UI state management.
 * Server data (workspaces, channels) should be accessed via React Query hooks.
 *
 * Benefits of this separation:
 * - No data duplication between Zustand and React Query
 * - Single source of truth for server state (React Query cache)
 * - Zustand only for what it's best at: client-side UI state
 * - Automatic persistence of selected workspace across sessions
 *
 * @example
 * ```tsx
 * function WorkspaceSelector() {
 *   const { data } = useWorkspaceMemberships(); // Get data from React Query
 *   const { selectedWorkspaceId, setSelectedWorkspace } = useWorkspaceStore(); // Get UI state from Zustand
 *
 *   return (
 *     <div>
 *       {data?.data?.workspaces.map(workspace => (
 *         <button
 *           key={workspace.id}
 *           onClick={() => setSelectedWorkspace(workspace.id)}
 *           className={selectedWorkspaceId === workspace.id ? 'active' : ''}
 *         >
 *           {workspace.displayName}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedWorkspaceId: null,
        selectedWorkspaceDisplayName: null,
        selectedChannelId: null,
        selectedChannelDisplayName: null,

        // Actions
        setSelectedWorkspace: (workspaceId, displayName) =>
          set({
            selectedWorkspaceId: workspaceId,
            selectedWorkspaceDisplayName: displayName || null,
          }),

        setSelectedChannel: (channelId, displayName) =>
          set({
            selectedChannelId: channelId,
            selectedChannelDisplayName: displayName || null,
          }),

        clearSelectedChannel: () =>
          set({
            selectedChannelId: null,
            selectedChannelDisplayName: null,
          }),
      }),
      {
        name: "workspace-ui-state", // LocalStorage key
        partialize: (state) => ({
          selectedWorkspaceId: state.selectedWorkspaceId,
          selectedWorkspaceDisplayName: state.selectedWorkspaceDisplayName,
          selectedChannelId: state.selectedChannelId,
          selectedChannelDisplayName: state.selectedChannelDisplayName,
        }),
      }
    ),
    { name: "WorkspaceStore" }
  )
);
