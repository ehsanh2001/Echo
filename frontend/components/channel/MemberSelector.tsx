"use client";

import { useState, useMemo, memo } from "react";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/lib/hooks/useMembers";
import { useCurrentUser } from "@/lib/stores/user-store";
import type { WorkspaceMemberWithUser } from "@/types/workspace";

interface MemberSelectorProps {
  /** The workspace ID to fetch members from */
  workspaceId: string;
  /** Array of selected user IDs */
  selectedMemberIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (memberIds: string[]) => void;
  /** Whether to exclude the current user from the list (default: true) */
  excludeCurrentUser?: boolean;
}

/**
 * Get initials from a display name
 */
function getInitials(displayName: string | null | undefined): string {
  if (!displayName) return "??";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

/**
 * MemberSelector Component
 *
 * A searchable member selection component for private channels.
 * Features:
 * - Search by username, display name, or email
 * - Selected members always shown at top, even when filtered out
 * - Checkbox-style selection with visual feedback
 * - Memoized for performance with large member lists
 *
 * @example
 * ```tsx
 * <MemberSelector
 *   workspaceId={workspaceId}
 *   selectedMemberIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 * />
 * ```
 */
export function MemberSelector({
  workspaceId,
  selectedMemberIds,
  onSelectionChange,
  excludeCurrentUser = true,
}: MemberSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const currentUser = useCurrentUser();

  // Fetch all workspace members
  const { data: membersData, isLoading } = useWorkspaceMembers(workspaceId);

  // Filter members based on search query and exclusions
  const filteredMembers = useMemo(() => {
    if (!membersData?.data?.workspaceMembers) return [];

    let members = membersData.data.workspaceMembers;

    // Exclude current user if specified
    if (excludeCurrentUser && currentUser) {
      members = members.filter((m) => m.userId !== currentUser.id);
    }

    // If no search query, return all eligible members
    if (!searchQuery.trim()) return members;

    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.user.username.toLowerCase().includes(query) ||
        m.user.displayName?.toLowerCase().includes(query) ||
        m.user.email.toLowerCase().includes(query)
    );
  }, [membersData, searchQuery, currentUser, excludeCurrentUser]);

  // Get selected members (always show these, even when filtered out)
  const selectedMembers = useMemo(() => {
    if (!membersData?.data?.workspaceMembers) return [];
    return membersData.data.workspaceMembers.filter((m) =>
      selectedMemberIds.includes(m.userId)
    );
  }, [membersData, selectedMemberIds]);

  // Combine: selected members first, then filtered unselected members (deduplicated)
  const displayedMembers = useMemo(() => {
    const selectedSet = new Set(selectedMemberIds);
    const filteredNotSelected = filteredMembers.filter(
      (m) => !selectedSet.has(m.userId)
    );
    return [...selectedMembers, ...filteredNotSelected];
  }, [selectedMembers, filteredMembers, selectedMemberIds]);

  // Toggle member selection
  const toggleMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      onSelectionChange(selectedMemberIds.filter((id) => id !== userId));
    } else {
      onSelectionChange([...selectedMemberIds, userId]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, username, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Selected count */}
      <div className="text-sm text-muted-foreground">
        {selectedMemberIds.length} member
        {selectedMemberIds.length !== 1 ? "s" : ""} selected
      </div>

      {/* Member List */}
      <div className="max-h-64 overflow-y-auto border rounded-lg">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading members...
          </div>
        ) : displayedMembers.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery
              ? "No members found matching your search"
              : "No members available"}
          </div>
        ) : (
          displayedMembers.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isSelected={selectedMemberIds.includes(member.userId)}
              onToggle={() => toggleMember(member.userId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Individual member row with checkbox-style selection
 */
const MemberRow = memo(function MemberRow({
  member,
  isSelected,
  onToggle,
}: {
  member: WorkspaceMemberWithUser;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const { user } = member;
  const avatarInitials = getInitials(user.displayName || user.username);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-primary/10"
      )}
      onClick={onToggle}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Custom Checkbox */}
      <div
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-input hover:border-primary/50"
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </div>

      {/* Member Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName || user.username}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          avatarInitials
        )}
      </div>

      {/* Member Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {user.displayName || user.username}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          @{user.username} • {user.email}
        </div>
      </div>
    </div>
  );
});
