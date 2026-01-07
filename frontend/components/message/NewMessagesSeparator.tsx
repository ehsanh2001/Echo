/**
 * NewMessagesSeparator Component
 *
 * Displays a visual separator indicating the start of unread messages.
 * Shows a horizontal line with "New messages" text in the middle.
 */

interface NewMessagesSeparatorProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Separator component displayed between read and unread messages
 *
 * @example
 * ```tsx
 * <Message message={lastReadMessage} />
 * <NewMessagesSeparator />
 * <Message message={firstUnreadMessage} />
 * ```
 */
export function NewMessagesSeparator({ className }: NewMessagesSeparatorProps) {
  return (
    <div
      className={`flex items-center gap-4 my-4 ${className || ""}`}
      role="separator"
      aria-label="New messages below"
    >
      <div className="flex-1 border-t border-destructive" />
      <span className="text-xs font-medium text-destructive px-2">
        New messages
      </span>
      <div className="flex-1 border-t border-destructive" />
    </div>
  );
}
