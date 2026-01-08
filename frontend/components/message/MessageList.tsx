"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
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
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useUserStore } from "@/lib/stores/user-store";
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
 * MessageList component with simplified infinite scroll
 *
 * Simplified approach:
 * - Initial load returns ALL unread messages (or last N if no unread)
 * - We ALWAYS have the latest messages (no gaps)
 * - Only infinite scroll to load OLDER messages (scroll up)
 * - firstUnreadIndex from backend tells us where to show "New messages" separator
 */
export function MessageList({ workspaceId, channelId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const hasScrolledToUnreadRef = useRef<boolean>(false);
  const isNearBottomRef = useRef<boolean>(true);

  // Track previous values for scroll restoration
  const previousMessageCountRef = useRef<number>(0);
  const previousPageCountRef = useRef<number>(0);
  // Track the last message ID to detect new messages from socket (for own message detection)
  const lastMessageIdRef = useRef<string | null>(null);
  // Track the last message ID seen at the bottom (for "Jump to Latest" button)
  const lastSeenMessageIdRef = useRef<string | null>(null);
  // Capture scroll position BEFORE render - this runs synchronously during render
  const scrollSnapshotRef = useRef<{
    scrollTop: number;
    scrollHeight: number;
  } | null>(null);

  // Track if user is scrolled away from unread separator
  const [showJumpToUnread, setShowJumpToUnread] = useState(false);
  // Track if user is scrolled away from bottom (for "Jump to Latest" button)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  // Track when user is at bottom (state to trigger mark-as-read effect)
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Get current user to check if messages are from self
  const currentUser = useUserStore((state) => state.user);

  // Fetch message history with simplified infinite scroll
  const {
    data,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
    isLoading,
    isError,
    error,
    startedFromUnread,
    firstUnreadIndex,
  } = useMessageHistory(workspaceId, channelId);

  // Get flattened message list in chronological order (oldest to newest)
  const messages = useMessageList(data);

  // CRITICAL: Capture scroll position DURING render, BEFORE React updates the DOM
  // This runs synchronously before useLayoutEffect, ensuring we have the pre-update position
  if (messagesContainerRef.current) {
    scrollSnapshotRef.current = {
      scrollTop: messagesContainerRef.current.scrollTop,
      scrollHeight: messagesContainerRef.current.scrollHeight,
    };
  }

  // Get last read message number for "New messages" separator (fallback calculation)
  const lastReadMessageNo = useLastReadMessageNo(workspaceId, channelId);

  // Hook to mark channel as read
  const { markAsRead } = useMarkAsRead();

  // Get the latest message for marking as read
  const latestMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  // Calculate the actual first unread message index for display
  // The backend provides firstUnreadIndex relative to the initial page
  // After loading older pages, we need to adjust for the total message count
  const actualFirstUnreadIndex = (() => {
    if (!startedFromUnread || firstUnreadIndex < 0) {
      return -1; // No separator needed
    }
    // Pages are [oldest..., initial], so messages from older pages are prepended
    // We need to count how many messages were loaded before the initial page
    // Initial page is the last one in the array
    if (!data?.pages.length) {
      return -1;
    }
    // Count messages from all pages except the last (initial) one
    let olderMessagesCount = 0;
    for (let i = 0; i < data.pages.length - 1; i++) {
      olderMessagesCount += data.pages[i].messages.length;
    }
    return olderMessagesCount + firstUnreadIndex;
  })();

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
        // actualFirstUnreadIndex >= 0 means we have unread messages
        if (actualFirstUnreadIndex >= 0 && firstUnreadRef.current) {
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
    actualFirstUnreadIndex,
    scrollToFirstUnread,
    scrollToBottom,
  ]);

  // Reset scroll tracking when channel changes
  useEffect(() => {
    hasScrolledToUnreadRef.current = false;
    setShowJumpToUnread(false);
    setShowJumpToLatest(false);
    lastSeenMessageIdRef.current = null;
  }, [channelId]);

  // Get store action for syncing "is at bottom" state
  const setIsAtBottomOfMessages = useWorkspaceStore(
    (state) => state.setIsAtBottomOfMessages
  );

  /**
   * Sync "is at bottom of messages" state with workspace store
   * This is used by socket handler to decide on badge increment
   */
  useEffect(() => {
    setIsAtBottomOfMessages(isAtBottom);
  }, [isAtBottom, setIsAtBottomOfMessages]);

  /**
   * Track scroll position to show/hide "Jump to unread" button
   */
  useEffect(() => {
    if (!messagesContainerRef.current || actualFirstUnreadIndex < 0) {
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
  }, [actualFirstUnreadIndex]);

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

      // Update last seen message ID when near bottom
      if (isNearBottom && messages.length > 0) {
        const latestId = messages[messages.length - 1].id;
        lastSeenMessageIdRef.current = latestId;
        setShowJumpToLatest(false);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages]);

  /**
   * Show "Jump to Latest" when new messages arrive via SOCKET while scrolled up
   * Uses message ID comparison to reliably detect new socket messages
   * Pagination loads OLDER messages (with smaller IDs/earlier dates), not newer ones
   */
  useEffect(() => {
    if (messages.length === 0) return;

    const currentLatestId = messages[messages.length - 1].id;
    const lastSeenId = lastSeenMessageIdRef.current;

    // If we haven't seen any message yet, initialize
    if (!lastSeenId) {
      if (isNearBottomRef.current) {
        lastSeenMessageIdRef.current = currentLatestId;
      }
      return;
    }

    // If the latest message ID changed and user is not near bottom,
    // it means a NEW message arrived (socket), not old messages (pagination)
    // Pagination adds messages at the START, not the END, so latest ID stays same
    if (currentLatestId !== lastSeenId && !isNearBottomRef.current) {
      setShowJumpToLatest(true);
    }
  }, [messages]);

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
   * Intersection Observer for infinite scroll (older messages)
   * Loads more messages when user scrolls near the top
   */
  useEffect(() => {
    if (
      !loadMoreTriggerRef.current ||
      !hasPreviousPage ||
      isFetchingPreviousPage
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          hasPreviousPage &&
          !isFetchingPreviousPage
        ) {
          // Scroll position is captured during render - just trigger fetch
          fetchPreviousPage();
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
  }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

  /**
   * Unified scroll position preservation for both:
   * 1. New messages arriving via socket (appended to end)
   * 2. Older messages loaded via pagination (prepended to start)
   *
   * Strategy:
   * - Before any change: Save scrollTop and scrollHeight
   * - After change: Calculate diff and restore position
   * - Exception: User's own new messages should scroll to bottom
   *
   * This uses useLayoutEffect to run synchronously after DOM updates but before paint,
   * ensuring smooth visual experience without flicker.
   */
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const snapshot = scrollSnapshotRef.current;
    if (!container || messages.length === 0 || !snapshot) return;

    const currentMessageCount = messages.length;
    const currentPageCount = data?.pages?.length ?? 0;
    const previousMessageCount = previousMessageCountRef.current;
    const previousPageCount = previousPageCountRef.current;

    // Detect what kind of change happened
    const isNewSocketMessage =
      currentMessageCount > previousMessageCount &&
      currentPageCount === previousPageCount &&
      previousMessageCount > 0;

    const isNewPageLoaded =
      currentPageCount > previousPageCount && previousPageCount > 0;

    // Handle scroll preservation
    if (isNewSocketMessage || isNewPageLoaded) {
      const newScrollHeight = container.scrollHeight;
      const scrollHeightDiff = newScrollHeight - snapshot.scrollHeight;

      if (scrollHeightDiff > 0) {
        if (isNewSocketMessage) {
          // Messages APPENDED at the bottom
          const latestMessage = messages[messages.length - 1];
          const isOwnMessage = latestMessage?.userId === currentUser?.id;

          if (isOwnMessage) {
            // User sent their own message - scroll to bottom
            scrollToBottom(true);
          } else {
            // Message from another user - keep scrollTop the SAME
            // (content added below doesn't affect what user is viewing)
            container.scrollTop = snapshot.scrollTop;
          }
        } else if (isNewPageLoaded) {
          // Messages PREPENDED at the top - add the diff to maintain position
          container.scrollTop = snapshot.scrollTop + scrollHeightDiff;
        }
      }
    }

    // Update the last message ID (used elsewhere)
    if (messages.length > 0) {
      lastMessageIdRef.current = messages[messages.length - 1].id;
    }

    // Save current state for next comparison
    previousMessageCountRef.current = currentMessageCount;
    previousPageCountRef.current = currentPageCount;
  }, [messages, data?.pages?.length, currentUser?.id, scrollToBottom]);

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
      {/* Load More Trigger (for infinite scroll - older messages) */}
      {hasPreviousPage && (
        <div ref={loadMoreTriggerRef} className="flex justify-center py-2">
          {isFetchingPreviousPage ? (
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
        const showNewMessagesSeparator = index === actualFirstUnreadIndex;

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
            // Update last seen ID to current latest
            if (messages.length > 0) {
              lastSeenMessageIdRef.current = messages[messages.length - 1].id;
            }
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
