"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSendMessage } from "@/lib/hooks/useMessageMutations";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useReplyStore } from "@/lib/stores/reply-store";
import { ParentMessagePreview } from "@/components/message/ParentMessagePreview";
import { MAX_MESSAGE_LENGTH } from "@/lib/validations";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  /** Workspace ID for sending messages */
  workspaceId: string;
  /** Channel ID for sending messages */
  channelId: string;
  /** Channel name for placeholder text */
  channelName?: string;
  /** Callback when message is successfully sent */
  onMessageSent?: (messageId: string) => void;
}

/**
 * MessageInput Component
 *
 * Auto-expanding textarea for composing and sending messages.
 *
 * Features:
 * - Auto-expanding textarea (grows with content)
 * - Character counter (always visible)
 * - Send button (disabled when empty or exceeds limit)
 * - Keyboard shortcuts:
 *   - Enter → Send message
 *   - Shift+Enter → New line
 * - Optimistic updates (message appears immediately)
 * - Loading state during send
 * - Automatic retry on failure (exponential backoff)
 * - Character limit validation
 * - Reply functionality with parent message preview
 *
 * @example
 * ```tsx
 * <MessageInput
 *   workspaceId="workspace-123"
 *   channelId="channel-456"
 *   channelName="general"
 * />
 * ```
 */
export function MessageInput({
  workspaceId,
  channelId,
  channelName = "channel",
  onMessageSent,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessageMutation = useSendMessage(workspaceId, channelId);
  const { replyingTo, clearReply } = useReplyStore();

  // Clear reply state when switching channels
  useEffect(() => {
    clearReply();
  }, [channelId, clearReply]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    // Set height to scrollHeight (content height)
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

  // Calculate remaining characters
  const remainingChars = MAX_MESSAGE_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;
  const isNearLimit = remainingChars <= 100 && remainingChars >= 0;
  const isEmpty = content.trim().length === 0;

  /**
   * Handle sending the message
   */
  const handleSend = async () => {
    if (isEmpty || isOverLimit || sendMessageMutation.isPending) {
      return;
    }

    const messageContent = content.trim();

    // Generate correlation ID for optimistic updates
    const correlationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Send message via mutation
    sendMessageMutation.mutate(
      {
        content: messageContent,
        clientMessageCorrelationId: correlationId,
        parentMessageId: replyingTo?.id, // Include parent ID if replying
      },
      {
        onSuccess: (response) => {
          // Clear input on success
          setContent("");
          // Clear reply state
          clearReply();
          // Reset textarea height
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
          // Call callback if provided
          onMessageSent?.(response.data.id);
        },
      }
    );
  };

  /**
   * Handle keyboard shortcuts
   * - Enter → Send message
   * - Shift+Enter → New line
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent newline on Enter
      handleSend();
    }
    // Shift+Enter will naturally create a newline
  };

  /**
   * Handle textarea input change
   */
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  return (
    <div className="p-4 border-t border-border shrink-0 bg-background">
      <div className="relative">
        {/* Reply Preview (shown when replying) */}
        {replyingTo && (
          <div className="w-1/2 mb-2">
            <ParentMessagePreview
              variant="composer"
              authorName={
                replyingTo.author.displayName || replyingTo.author.username
              }
              content={replyingTo.content}
              isReply={!!replyingTo.parentMessageId}
              onClose={clearReply}
            />
          </div>
        )}

        {/* Auto-expanding textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            disabled={sendMessageMutation.isPending}
            rows={1}
            className={cn(
              "w-full resize-none",
              "rounded-lg border border-input bg-muted/50",
              "px-4 py-3 pr-32", // Extra padding on right for button and counter
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allow disabled:opacity-50",
              "transition-colors",
              "min-h-[44px] max-h-[200px]", // Min and max height
              content.split("\n").length > 6
                ? "overflow-y-auto"
                : "overflow-hidden",
              isOverLimit && "border-destructive focus:ring-destructive"
            )}
          />

          {/* Character counter and send button container */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            {/* Character counter - Always visible */}
            <div
              className={cn(
                "text-xs font-medium transition-colors",
                isOverLimit && "text-destructive",
                isNearLimit &&
                  !isOverLimit &&
                  "text-yellow-600 dark:text-yellow-500",
                !isNearLimit && !isOverLimit && "text-muted-foreground"
              )}
            >
              {remainingChars}
            </div>

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={isEmpty || isOverLimit || sendMessageMutation.isPending}
              size="sm"
              className="h-8 px-3"
            >
              {sendMessageMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error message for character limit */}
        {isOverLimit && (
          <p className="mt-2 text-xs text-destructive">
            Message exceeds maximum length by {Math.abs(remainingChars)}{" "}
            characters
          </p>
        )}

        {/* Keyboard shortcut hint */}
        <p className="mt-2 text-xs text-muted-foreground">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">
            Enter
          </kbd>{" "}
          to send,{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">
            Shift+Enter
          </kbd>{" "}
          for new line
        </p>
      </div>
    </div>
  );
}
