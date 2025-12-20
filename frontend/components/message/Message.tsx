"use client";

import { memo, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Check, CheckCheck, Reply } from "lucide-react";
import type { MessageWithAuthorResponse } from "@/types/message";
import { useCurrentUser } from "@/lib/stores/user-store";
import { useReplyStore } from "@/lib/stores/reply-store";
import { useParentMessage } from "@/lib/hooks/useParentMessage";
import { ParentMessagePreview } from "./ParentMessagePreview";

interface MessageProps {
  message: MessageWithAuthorResponse;
}

/**
 * Individual message component
 * Displays a single message with author info, timestamp, and content
 *
 * Memoized for performance in virtualized lists
 */
export const Message = memo(function Message({ message }: MessageProps) {
  const currentUser = useCurrentUser();
  const isOwn = currentUser?.id === message.userId;
  const { setReplyingTo } = useReplyStore();

  // Check if this is an optimistic message (pending confirmation)
  const isPending = (message as any).isPending === true;

  // Fetch parent message if this is a reply
  const { data: parentMessage, isLoading: isLoadingParent } = useParentMessage(
    message.workspaceId,
    message.channelId,
    message.parentMessageId
  );

  // Debug logging
  useEffect(() => {
    if (message.parentMessageId) {
      console.log("Reply message detected:", {
        messageId: message.id,
        parentMessageId: message.parentMessageId,
        parentMessage,
        isLoading: isLoadingParent,
      });
    }
  }, [message.id, message.parentMessageId, parentMessage, isLoadingParent]);

  // Handler for clicking reply button
  const handleReplyClick = () => {
    setReplyingTo(message);
  };

  // Handler for scrolling to parent message
  const handleScrollToParent = () => {
    if (message.parentMessageId) {
      const parentElement = document.getElementById(
        `message-${message.parentMessageId}`
      );
      if (parentElement) {
        parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
        // Add highlight effect
        parentElement.classList.add("message-highlight");
        setTimeout(() => {
          parentElement.classList.remove("message-highlight");
        }, 2000);
      }
    }
  };

  // Format timestamp using date-fns
  const formattedTime = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
  });

  // Get avatar initials from display name or username
  const getInitials = (displayName: string, username: string): string => {
    const name = displayName || username;
    const parts = name.trim().split(/\s+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
  };

  const avatarInitials = getInitials(
    message.author.displayName,
    message.author.username
  );

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex gap-4 max-w-[80%] ${
        isOwn ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {/* User Avatar */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
          isOwn
            ? "bg-gradient-to-br from-yellow-500 to-red-500"
            : "bg-gradient-to-br from-primary to-primary/70"
        } text-white`}
        title={message.author.displayName || message.author.username}
      >
        {message.author.avatarUrl ? (
          <img
            src={message.author.avatarUrl}
            alt={message.author.displayName || message.author.username}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          avatarInitials
        )}
      </div>

      {/* Message Bubble Container */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
          } ${isPending ? "opacity-70" : ""}`}
        >
          {/* Parent Message Preview (if this is a reply) */}
          {message.parentMessageId && (
            <div className="w-1/2 mb-3">
              {isLoadingParent ? (
                <div className="text-xs text-muted-foreground p-2">
                  Loading parent message...
                </div>
              ) : (
                <ParentMessagePreview
                  variant="message"
                  isOwnMessage={isOwn}
                  authorName={
                    parentMessage
                      ? parentMessage.author.displayName ||
                        parentMessage.author.username
                      : "Unknown"
                  }
                  content={parentMessage?.content || ""}
                  isReply={!!parentMessage?.parentMessageId}
                  isDeleted={!parentMessage}
                  onClick={handleScrollToParent}
                />
              )}
            </div>
          )}

          {/* Sender Name and Timestamp */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">
              {isOwn
                ? "You"
                : message.author.displayName || message.author.username}
            </span>
            <span
              className={`text-xs ${
                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {formattedTime}
            </span>
            {message.isEdited && (
              <span
                className={`text-xs italic ${
                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                (edited)
              </span>
            )}

            {/* Reply Button (shows on hover) */}
            <button
              onClick={handleReplyClick}
              className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background/10 ${
                isOwn ? "text-primary-foreground" : "text-foreground"
              }`}
              aria-label="Reply to message"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>

            {/* Message Status Indicator (only for own messages) */}
            {isOwn && (
              <span className={message.isEdited ? "" : "ml-auto"}>
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary-foreground/70" />
                ) : (
                  <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                )}
              </span>
            )}
          </div>

          {/* Message Content */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
});
