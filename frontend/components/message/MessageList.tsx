"use client";

import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { Message } from "./Message";
import {
  useMessageHistory,
  useMessageList,
} from "@/lib/hooks/useMessageQueries";
import type { MessageWithAuthorResponse } from "@/types/message";

interface MessageListProps {
  workspaceId: string;
  channelId: string;
}

/**
 * Format date for separator (e.g., "Today", "Yesterday", "November 15, 2025")
 */
function formatDateSeparator(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

/**
 * DateSeparator component - horizontal line with date in the middle
 */
function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 border-t border-border" />
      <div className="px-3 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground">
        {formatDateSeparator(date)}
      </div>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

/**
 * MessageList component with infinite scroll
 *
 * Features:
 * - Loads latest messages on mount
 * - Infinite scroll to load older messages
 * - Auto-scrolls to bottom on initial load
 * - Virtualized for performance (simple implementation)
 */
export function MessageList({ workspaceId, channelId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);

  // Fetch message history with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useMessageHistory(workspaceId, channelId);

  // Get flattened message list in chronological order (oldest to newest)
  const messages = useMessageList(data);

  /**
   * Scroll to bottom (for initial load or new messages)
   */
  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  /**
   * Initial scroll to bottom when messages first load
   * Use useLayoutEffect to run synchronously after DOM mutations but before paint
   */
  useLayoutEffect(() => {
    if (messages.length > 0 && !isLoading) {
      scrollToBottom(false);
    }
  }, [messages.length > 0 && !isLoading, scrollToBottom]); // Only on first load

  /**
   * Intersection Observer for infinite scroll
   * Loads more messages when user scrolls near the top
   */
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          // Save current scroll position before fetching
          if (messagesContainerRef.current) {
            previousScrollHeightRef.current =
              messagesContainerRef.current.scrollHeight;
          }

          fetchNextPage();
        }
      },
      {
        root: messagesContainerRef.current,
        rootMargin: "100px", // Trigger 100px before reaching the element
        threshold: 0.1,
      }
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Maintain scroll position when loading older messages
   */
  useEffect(() => {
    if (isFetchingNextPage || !messagesContainerRef.current) {
      return;
    }

    // After new messages are loaded, adjust scroll to maintain position
    const container = messagesContainerRef.current;
    const newScrollHeight = container.scrollHeight;
    const scrollHeightDiff = newScrollHeight - previousScrollHeightRef.current;

    if (scrollHeightDiff > 0) {
      container.scrollTop = container.scrollTop + scrollHeightDiff;
    }
  }, [messages.length, isFetchingNextPage]);

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <p className="text-sm text-destructive">Failed to load messages</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  /**
   * Empty state
   */
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <p className="text-sm text-muted-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground">
            Be the first to send a message in this channel!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-5 min-h-0"
    >
      {/* Load More Trigger (for infinite scroll) */}
      {hasNextPage && (
        <div ref={loadMoreTriggerRef} className="flex justify-center py-2">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading older messages...</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Scroll up to load more
            </div>
          )}
        </div>
      )}

      {/* Messages with Date Separators */}
      {messages.map((message, index) => {
        const currentDate = new Date(message.createdAt);
        const previousDate =
          index > 0 ? new Date(messages[index - 1].createdAt) : null;
        const showDateSeparator =
          !previousDate || !isSameDay(currentDate, previousDate);

        return (
          <div key={message.id} id={`message-${message.id}`} className="mb-4">
            {showDateSeparator && <DateSeparator date={currentDate} />}
            <Message message={message} />
          </div>
        );
      })}

      {/* Scroll anchor for auto-scroll to bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
}
