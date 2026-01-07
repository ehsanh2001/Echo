/**
 * Unread Store using Zustand
 *
 * Manages unread message counts for channels across workspaces.
 * Updated by:
 * - Initial fetch when loading a workspace (via React Query)
 * - Socket events for new messages (increment)
 * - User reading a channel (clear/update)
 * - Socket events for read receipt updates (sync across tabs)
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ChannelUnreadInfo } from "@/types/message";

interface UnreadState {
  /**
   * Nested map: workspaceId -> channelId -> unread count
   * Using Record for JSON serialization compatibility
   */
  unreadCounts: Record<string, Record<string, number>>;

  /**
   * Last read message number per channel
   * Used for determining where to show "New messages" separator
   * workspaceId -> channelId -> lastReadMessageNo
   */
  lastReadMessageNo: Record<string, Record<string, number>>;

  // ===== Actions =====

  /**
   * Set unread counts for multiple channels in a workspace
   * Called when fetching initial unread counts from API
   */
  setUnreadCounts: (workspaceId: string, counts: ChannelUnreadInfo[]) => void;

  /**
   * Increment unread count for a channel
   * Called when a new message arrives via socket
   */
  incrementUnread: (workspaceId: string, channelId: string) => void;

  /**
   * Clear unread count for a channel (set to 0)
   * Called when user reads a channel
   */
  clearUnread: (
    workspaceId: string,
    channelId: string,
    lastReadMessageNo: number
  ) => void;

  /**
   * Update the last read message number for a channel
   * Called when read receipt is updated (from API or socket)
   */
  updateLastReadMessageNo: (
    workspaceId: string,
    channelId: string,
    messageNo: number
  ) => void;

  /**
   * Get unread count for a specific channel
   */
  getChannelUnread: (workspaceId: string, channelId: string) => number;

  /**
   * Get total unread count for a workspace (sum of all channels)
   */
  getWorkspaceUnread: (workspaceId: string) => number;

  /**
   * Get the last read message number for a channel
   */
  getLastReadMessageNo: (workspaceId: string, channelId: string) => number;

  /**
   * Clear all unread data for a workspace
   * Called when user leaves a workspace
   */
  clearWorkspaceUnreads: (workspaceId: string) => void;

  /**
   * Clear all unread data
   * Called on logout
   */
  clearAllUnreads: () => void;
}

/**
 * Zustand store for unread message counts
 *
 * @example
 * ```tsx
 * function ChannelItem({ workspaceId, channelId }) {
 *   const unreadCount = useUnreadStore(
 *     state => state.getChannelUnread(workspaceId, channelId)
 *   );
 *
 *   return (
 *     <div>
 *       Channel Name
 *       {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
 *     </div>
 *   );
 * }
 * ```
 */
export const useUnreadStore = create<UnreadState>()(
  devtools(
    (set, get) => ({
      // Initial state
      unreadCounts: {},
      lastReadMessageNo: {},

      // Actions
      setUnreadCounts: (workspaceId, counts) => {
        set((state) => {
          const newUnreadCounts = { ...state.unreadCounts };
          const newLastReadMessageNo = { ...state.lastReadMessageNo };

          // Initialize workspace maps if needed
          if (!newUnreadCounts[workspaceId]) {
            newUnreadCounts[workspaceId] = {};
          }
          if (!newLastReadMessageNo[workspaceId]) {
            newLastReadMessageNo[workspaceId] = {};
          }

          // Set counts for each channel
          for (const channelInfo of counts) {
            newUnreadCounts[workspaceId][channelInfo.channelId] =
              channelInfo.unreadCount;
            newLastReadMessageNo[workspaceId][channelInfo.channelId] =
              channelInfo.lastReadMessageNo;
          }

          return {
            unreadCounts: newUnreadCounts,
            lastReadMessageNo: newLastReadMessageNo,
          };
        });
      },

      incrementUnread: (workspaceId, channelId) => {
        set((state) => {
          const newUnreadCounts = { ...state.unreadCounts };

          // Initialize workspace map if needed
          if (!newUnreadCounts[workspaceId]) {
            newUnreadCounts[workspaceId] = {};
          }

          // Increment count (default to 0 if not set)
          const currentCount = newUnreadCounts[workspaceId][channelId] || 0;
          newUnreadCounts[workspaceId][channelId] = currentCount + 1;

          return { unreadCounts: newUnreadCounts };
        });
      },

      clearUnread: (workspaceId, channelId, lastReadMessageNo) => {
        set((state) => {
          const newUnreadCounts = { ...state.unreadCounts };
          const newLastReadMessageNo = { ...state.lastReadMessageNo };

          // Initialize workspace maps if needed
          if (!newUnreadCounts[workspaceId]) {
            newUnreadCounts[workspaceId] = {};
          }
          if (!newLastReadMessageNo[workspaceId]) {
            newLastReadMessageNo[workspaceId] = {};
          }

          // Clear unread count
          newUnreadCounts[workspaceId][channelId] = 0;

          // Update last read position
          newLastReadMessageNo[workspaceId][channelId] = lastReadMessageNo;

          return {
            unreadCounts: newUnreadCounts,
            lastReadMessageNo: newLastReadMessageNo,
          };
        });
      },

      updateLastReadMessageNo: (workspaceId, channelId, messageNo) => {
        set((state) => {
          const newLastReadMessageNo = { ...state.lastReadMessageNo };

          // Initialize workspace map if needed
          if (!newLastReadMessageNo[workspaceId]) {
            newLastReadMessageNo[workspaceId] = {};
          }

          // Only update if new position is ahead
          const currentPos = newLastReadMessageNo[workspaceId][channelId] || 0;
          if (messageNo > currentPos) {
            newLastReadMessageNo[workspaceId][channelId] = messageNo;
          }

          return { lastReadMessageNo: newLastReadMessageNo };
        });
      },

      getChannelUnread: (workspaceId, channelId) => {
        const state = get();
        return state.unreadCounts[workspaceId]?.[channelId] || 0;
      },

      getWorkspaceUnread: (workspaceId) => {
        const state = get();
        const workspaceUnreads = state.unreadCounts[workspaceId];

        if (!workspaceUnreads) return 0;

        return Object.values(workspaceUnreads).reduce(
          (sum, count) => sum + count,
          0
        );
      },

      getLastReadMessageNo: (workspaceId, channelId) => {
        const state = get();
        return state.lastReadMessageNo[workspaceId]?.[channelId] || 0;
      },

      clearWorkspaceUnreads: (workspaceId) => {
        set((state) => {
          const newUnreadCounts = { ...state.unreadCounts };
          const newLastReadMessageNo = { ...state.lastReadMessageNo };

          delete newUnreadCounts[workspaceId];
          delete newLastReadMessageNo[workspaceId];

          return {
            unreadCounts: newUnreadCounts,
            lastReadMessageNo: newLastReadMessageNo,
          };
        });
      },

      clearAllUnreads: () => {
        set({ unreadCounts: {}, lastReadMessageNo: {} });
      },
    }),
    { name: "UnreadStore" }
  )
);
