"use client";

import { X, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParentMessagePreviewProps {
  /** Author's display name or username */
  authorName: string;
  /** Message content (may be truncated) */
  content: string;
  /** True if parent is also a reply (shows nested reply icon) */
  isReply: boolean;
  /** True if parent message was deleted */
  isDeleted?: boolean;
  /** Display variant: "composer" (with close button) or "message" (clickable) */
  variant: "composer" | "message";
  /** True if this is the user's own message (for background styling) */
  isOwnMessage?: boolean;
  /** Close handler for composer variant */
  onClose?: () => void;
  /** Click handler for message variant (scroll to parent) */
  onClick?: () => void;
}

/**
 * ParentMessagePreview Component
 *
 * Displays a compact preview of a parent message for the reply feature.
 * Used in two contexts:
 * 1. "composer" variant - Shows in message input when replying (with close button)
 * 2. "message" variant - Shows in reply messages (clickable to scroll to parent)
 *
 * Features:
 * - Fixed height with ellipsis truncation
 * - Left border accent (WhatsApp-style)
 * - Author name in bold
 * - Reply chain icon if parent is also a reply
 * - Close button for composer variant
 * - Clickable for message variant
 * - Handles deleted parent messages
 *
 * @example
 * ```tsx
 * // In MessageInput (composer variant)
 * <ParentMessagePreview
 *   variant="composer"
 *   authorName="John Doe"
 *   content="This is the original message"
 *   isReply={false}
 *   onClose={clearReply}
 * />
 *
 * // In Message component (message variant)
 * <ParentMessagePreview
 *   variant="message"
 *   authorName="Jane Smith"
 *   content="Parent message content"
 *   isReply={true}
 *   onClick={() => scrollToMessage(parentId)}
 * />
 * ```
 */
export function ParentMessagePreview({
  authorName,
  content,
  isReply,
  isDeleted = false,
  variant,
  isOwnMessage = false,
  onClose,
  onClick,
}: ParentMessagePreviewProps) {
  const isComposer = variant === "composer";
  const isClickable = variant === "message" && !isDeleted;

  // Truncate content to ~100 characters for display
  const truncatedContent =
    content.length > 100 ? `${content.substring(0, 100)}...` : content;

  return (
    <div
      className={cn(
        "relative flex items-start gap-2 rounded-lg border-l-4 p-3",
        // Border and background colors
        isComposer
          ? "border-l-primary bg-muted/50"
          : isOwnMessage
            ? "border-l-primary-foreground/20 bg-primary-foreground/10"
            : "border-l-muted-foreground/30 bg-background/50",
        // Clickable styling
        isClickable && "cursor-pointer hover:bg-muted/50 transition-colors",
        // Deleted message styling
        isDeleted && "opacity-60"
      )}
      onClick={isClickable ? onClick : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Reply chain icon (if parent is also a reply) */}
      {isReply && !isDeleted && (
        <CornerDownRight
          className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5"
          aria-label="Nested reply"
        />
      )}

      {/* Content container */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Author name */}
        <div className="font-semibold text-sm text-foreground mb-0.5 truncate">
          {isDeleted ? "Deleted message" : authorName}
        </div>

        {/* Message content */}
        <div
          className={cn(
            "text-xs leading-relaxed line-clamp-2",
            isDeleted ? "italic text-muted-foreground" : "text-foreground/80"
          )}
        >
          {isDeleted ? "Original message deleted" : truncatedContent}
        </div>
      </div>

      {/* Close button (composer variant only) */}
      {isComposer && onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Cancel reply"
          type="button"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
