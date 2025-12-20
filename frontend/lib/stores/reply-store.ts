/**
 * Reply Store - Zustand store for reply/parent message state
 *
 * Manages the state when a user wants to reply to a message.
 * When a user clicks "reply" on a message, that message becomes the "replyingTo" message.
 * This is displayed in the message composer until the user sends the reply or cancels.
 *
 * Architecture:
 * - Simple non-persisted store (reply state should be session-only)
 * - Stores the full message object being replied to
 * - Used by MessageInput to show parent preview
 * - Used by Message component to trigger reply action
 *
 * Flow:
 * 1. User clicks reply button on a message
 * 2. setReplyingTo(message) is called
 * 3. MessageInput shows parent preview with cancel button
 * 4. When message is sent, clearReply() is called
 * 5. Or user can click cancel button to call clearReply()
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { MessageWithAuthorResponse } from "@/types/message";

/**
 * Reply store state interface
 */
interface ReplyStore {
  /**
   * The message being replied to (null if not replying)
   */
  replyingTo: MessageWithAuthorResponse | null;

  /**
   * Set the message being replied to
   * Called when user clicks reply button on a message
   *
   * @param message - The message to reply to
   */
  setReplyingTo: (message: MessageWithAuthorResponse | null) => void;

  /**
   * Clear the reply state
   * Called when user sends reply, cancels, or switches channels
   */
  clearReply: () => void;
}

/**
 * Reply store instance
 *
 * Usage:
 * ```typescript
 * // In Message component (reply button)
 * const { setReplyingTo } = useReplyStore();
 * <button onClick={() => setReplyingTo(message)}>Reply</button>
 *
 * // In MessageInput component
 * const { replyingTo, clearReply } = useReplyStore();
 * {replyingTo && <ParentPreview message={replyingTo} onClose={clearReply} />}
 * ```
 */
export const useReplyStore = create<ReplyStore>()(
  devtools(
    (set) => ({
      replyingTo: null,

      setReplyingTo: (message) =>
        set({ replyingTo: message }, false, "setReplyingTo"),

      clearReply: () => set({ replyingTo: null }, false, "clearReply"),
    }),
    { name: "ReplyStore" }
  )
);
