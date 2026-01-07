"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { Message } from "./Message";
import { NewMessagesSeparator } from "./NewMessagesSeparator";
import {
  useMessageHistory,
  useMessageList,
} from "@/lib/hooks/useMessageQueries";
import {
  useLastReadMessageNo,
  useMarkAsRead,
} from "@/lib/hooks/useUnreadCounts";
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
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const hasScrolledToUnreadRef = useRef<boolean>(false);
  const isNearBottomRef = useRef<boolean>(true);

  // Track if user is scrolled away from unread separator
  const [showJumpToUnread, setShowJumpToUnread] = useState(false);
  // Track if user is scrolled away from bottom (for "Jump to Latest" button)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  // Track the message count to detect new messages while scrolled up
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  // Track when user is at bottom (state to trigger mark-as-read effect)
  const [isAtBottom, setIsAtBottom] = useState(true);

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

  // Get last read message number for "New messages" separator
  const lastReadMessageNo = useLastReadMessageNo(workspaceId, channelId);

  // Hook to mark channel as read
  const { markAsRead } = useMarkAsRead();

  // Get the latest message for marking as read
  const latestMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  // Find the first unread message index (for showing "New messages" separator)
  const firstUnreadMessageIndex = useMemo(() => {
    if (lastReadMessageNo <= 0 || messages.length === 0) {
      return -1; // No separator needed
    }

    // Find the first message with messageNo > lastReadMessageNo
    const index = messages.findIndex(
      (msg) => msg.messageNo > lastReadMessageNo
    );

    return index;
  }, [messages, lastReadMessageNo]);

  /**
   * Scroll to bottom (for initial load or new messages)
   */
  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  /**
   * Scroll to first unread message
   */
  const scrollToFirstUnread = useCallback((smooth = false) => {
    firstUnreadRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "start",
    });
  }, []);

  /**
   * Initial scroll when messages first load
   * - If there are unread messages, scroll to the first unread
   * - Otherwise, scroll to the bottom
   * Use useLayoutEffect to run synchronously after DOM mutations but before paint
   */
  useLayoutEffect(() => {
    if (messages.length > 0 && !isLoading && !hasScrolledToUnreadRef.current) {
      // Mark that we've done the initial scroll
      hasScrolledToUnreadRef.current = true;

      // Use requestAnimationFrame to ensure refs are attached
      requestAnimationFrame(() => {
        if (firstUnreadMessageIndex > 0 && firstUnreadRef.current) {
          // Scroll to first unread message
          scrollToFirstUnread(false);
        } else {
          // No unread messages - scroll to bottom
          scrollToBottom(false);
        }
      });
    }
  }, [
    messages.length > 0 && !isLoading,
    firstUnreadMessageIndex,
    scrollToFirstUnread,
    scrollToBottom,
  ]);

  // Reset scroll tracking when channel changes
  useEffect(() => {
    hasScrolledToUnreadRef.current = false;
    setShowJumpToUnread(false);
  }, [channelId]);

  /**
   * Track scroll position to show/hide "Jump to unread" button
   */
  useEffect(() => {
    if (!messagesContainerRef.current || firstUnreadMessageIndex < 0) {
      setShowJumpToUnread(false);
      return;
    }

    const container = messagesContainerRef.current;

    const handleScroll = () => {
      if (!firstUnreadRef.current || !container) return;

      // Check if the first unread message is above the visible area
      const unreadRect = firstUnreadRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Show button if unread separator is above the visible viewport
      const isAboveViewport = unreadRect.bottom < containerRect.top;
      setShowJumpToUnread(isAboveViewport);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [firstUnreadMessageIndex]);

  /**
   * Track scroll position to show/hide "Jump to Latest" button
   * Shows when user scrolls up from bottom and new messages arrive
   */
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const SCROLL_THRESHOLD = 100; // px from bottom

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < SCROLL_THRESHOLD;

      isNearBottomRef.current = isNearBottom;
      setIsAtBottom(isNearBottom);

      // Update last seen message count when near bottom
      if (isNearBottom) {
        setLastSeenMessageCount(messages.length);
        setShowJumpToLatest(false);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  /**
   * Show "Jump to Latest" when new messages arrive while scrolled up
   */
  useEffect(() => {
    // Only show if we have messages, not near bottom, and new messages arrived
    if (
      messages.length > 0 &&
      !isNearBottomRef.current &&
      messages.length > lastSeenMessageCount &&
      lastSeenMessageCount > 0
    ) {
      setShowJumpToLatest(true);
    }
  }, [messages.length, lastSeenMessageCount]);

  /**
   * Auto-mark channel as read when user views messages at bottom
   * Triggered when:
   * - Messages finish loading and user is at bottom
   * - User scrolls to bottom (isAtBottom state changes)
   * - Latest message changes (new messages arrive while at bottom)
   */
  useEffect(() => {
    // Only mark as read if:
    // 1. We have a latest message
    // 2. User is at bottom (viewing the latest messages)
    // 3. There are actually unread messages (latestMessage.messageNo > lastReadMessageNo)
    if (
      latestMessage &&
      isAtBottom &&
      latestMessage.messageNo > lastReadMessageNo
    ) {
      markAsRead({
        workspaceId,
        channelId,
        messageNo: latestMessage.messageNo,
        messageId: latestMessage.id,
      });
    }
  }, [
    latestMessage?.messageNo,
    latestMessage?.id,
    lastReadMessageNo,
    isAtBottom,
    workspaceId,
    channelId,
    markAsRead,
  ]);

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

      {/* Messages with Date Separators and New Messages Separator */}
      {messages.map((message, index) => {
        const currentDate = new Date(message.createdAt);
        const previousDate =
          index > 0 ? new Date(messages[index - 1].createdAt) : null;
        const showDateSeparator =
          !previousDate || !isSameDay(currentDate, previousDate);
        const showNewMessagesSeparator = index === firstUnreadMessageIndex;

        return (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className="mb-4"
            // Attach ref to the first unread message for scroll-to-unread
            ref={showNewMessagesSeparator ? firstUnreadRef : undefined}
          >
            {showDateSeparator && <DateSeparator date={currentDate} />}
            {showNewMessagesSeparator && <NewMessagesSeparator />}
            <Message message={message} />
          </div>
        );
      })}

      {/* Scroll anchor for auto-scroll to bottom */}
      <div ref={messagesEndRef} />

      {/* Jump to Unread Button - shows when scrolled away from unread separator */}
      {showJumpToUnread && !showJumpToLatest && (
        <button
          onClick={() => scrollToFirstUnread(true)}
          className="fixed bottom-24 right-8 z-50 flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:bg-destructive/90 transition-colors"
          aria-label="Jump to unread messages"
        >
          <ArrowDown className="h-4 w-4" />
          <span className="text-sm font-medium">Jump to unread</span>
        </button>
      )}

      {/* Jump to Latest Button - shows when scrolled up and new messages arrived */}
      {showJumpToLatest && (
        <button
          onClick={() => {
            scrollToBottom(true);
            setShowJumpToLatest(false);
            setLastSeenMessageCount(messages.length);
          }}
          className="fixed bottom-24 right-8 z-50 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Jump to latest messages"
        >
          <ArrowDown className="h-4 w-4" />
          <span className="text-sm font-medium">New messages</span>
        </button>
      )}
    </div>
  );
}
