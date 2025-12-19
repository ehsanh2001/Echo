"use client";

import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  WorkspaceMemberWithUser,
  ChannelMemberWithUser,
} from "@/types/workspace";

interface MemberListItemProps {
  member: WorkspaceMemberWithUser | ChannelMemberWithUser;
}

/**
 * Get initials from a display name
 */
function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

/**
 * Individual member list item component
 * Displays member avatar, name, username, and role badge
 *
 * Memoized for performance in long member lists
 */
export const MemberListItem = memo(function MemberListItem({
  member,
}: MemberListItemProps) {
  const { user, role } = member;
  const avatarInitials = getInitials(user.displayName || user.username);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sidebar-accent transition-colors"
          aria-label={`View ${user.displayName}'s profile`}
        >
          {/* Member Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              avatarInitials
            )}
          </div>

          {/* Member Info */}
          <div className="flex-1 min-w-0 text-left">
            <div className="font-medium text-sm text-sidebar-foreground truncate">
              {user.displayName || user.username}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              @{user.username}
            </div>
          </div>

          {/* Role Badge - Only show for non-member roles */}
          {role !== "member" && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
              {role}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>
          {user.displayName || user.username}
          {role !== "member" && ` • ${role}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});
