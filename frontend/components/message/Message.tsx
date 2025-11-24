"use client";

import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Check, CheckCheck } from "lucide-react";
import type { MessageWithAuthorResponse } from "@/types/message";
import { useCurrentUser } from "@/lib/stores/user-store";

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

  // Check if this is an optimistic message (pending confirmation)
  const isPending = (message as any).isPending === true;

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
      className={`flex gap-4 max-w-[80%] ${
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

      {/* Message Bubble */}
      <div
        className={`rounded-2xl px-4 py-3 ${
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
        } ${isPending ? "opacity-70" : ""}`}
      >
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

          {/* Message Status Indicator (only for own messages) */}
          {isOwn && (
            <span className="ml-auto">
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
  );
});
