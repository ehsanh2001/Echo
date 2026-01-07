/**
 * useReadReceiptSocket Hook
 *
 * Listens to Socket.IO read receipt events and updates Zustand store.
 * Used for syncing read state across browser tabs/devices.
 */

import { useEffect } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import { useUnreadStore } from "@/lib/stores/unread-store";
import type { ReadReceiptUpdatedPayload } from "@/lib/socket/types";

/**
 * Logs debug information in development mode
 */
function logDev(message: string, data?: any) {
  if (process.env.NODE_ENV === "development") {
    console.log(message, data);
  }
}

/**
 * Hook to listen to Socket.IO read receipt events
 *
 * Should be called once at the app level (in main app page).
 * Updates the Zustand unread store when read receipts are updated
 * from other tabs/devices.
 *
 * @example
 * ```tsx
 * function AppPage() {
 *   useReadReceiptSocket(); // Listen to read receipt events
 *   return <div>App content</div>;
 * }
 * ```
 */
export function useReadReceiptSocket() {
  const clearUnread = useUnreadStore((state) => state.clearUnread);
  const updateLastReadMessageNo = useUnreadStore(
    (state) => state.updateLastReadMessageNo
  );

  useEffect(() => {
    const socket = getSocket();

    const handleReadReceiptUpdated = (data: ReadReceiptUpdatedPayload) => {
      logDev("[Socket] Received read-receipt:updated", {
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        lastReadMessageNo: data.lastReadMessageNo,
      });

      // Update the unread store - clear unread and update last read position
      clearUnread(data.workspaceId, data.channelId, data.lastReadMessageNo);

      logDev("[Socket] Updated unread store with new read position");
    };

    // Register read receipt event listener
    socket.on("read-receipt:updated", handleReadReceiptUpdated);
    logDev("[Socket] Read receipt listener registered");

    // Cleanup: remove listener on unmount
    return () => {
      socket.off("read-receipt:updated", handleReadReceiptUpdated);
      logDev("[Socket] Read receipt listener removed");
    };
  }, [clearUnread, updateLastReadMessageNo]);
}
