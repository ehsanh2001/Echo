/**
 * UnreadBadge Component
 *
 * Displays an unread message count badge.
 * Shows nothing when count is 0, shows "99+" for counts over 99.
 */

import { cn } from "@/lib/utils";

interface UnreadBadgeProps {
  /** Number of unread messages */
  count: number;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "default";
}

/**
 * Badge component displaying unread message count
 *
 * @example
 * ```tsx
 * <UnreadBadge count={5} />
 * <UnreadBadge count={150} /> // Shows "99+"
 * <UnreadBadge count={0} /> // Returns null
 * ```
 */
export function UnreadBadge({
  count,
  className,
  size = "default",
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-full bg-destructive text-destructive-foreground",
        size === "sm"
          ? "text-[10px] min-w-4 h-4 px-1"
          : "text-xs min-w-5 h-5 px-1.5",
        className
      )}
      aria-label={`${count} unread messages`}
    >
      {displayCount}
    </span>
  );
}
