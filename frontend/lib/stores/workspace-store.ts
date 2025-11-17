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

  // Actions
  setSelectedWorkspace: (workspaceId: string | null) => void;
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

        // Actions
        setSelectedWorkspace: (workspaceId) =>
          set({ selectedWorkspaceId: workspaceId }),
      }),
      {
        name: "workspace-ui-state", // LocalStorage key
        partialize: (state) => ({
          selectedWorkspaceId: state.selectedWorkspaceId,
        }),
      }
    ),
    { name: "WorkspaceStore" }
  )
);
