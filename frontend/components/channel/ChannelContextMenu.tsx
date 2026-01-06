"use client";

import { useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteChannelDialog } from "./DeleteChannelDialog";
import { ChannelRole, WorkspaceRole } from "@/types/workspace";

interface ChannelContextMenuProps {
  channelId: string;
  channelName: string;
  channelDisplayName: string | null;
  workspaceId: string;
  /** User's role in this channel */
  channelRole: ChannelRole;
  /** User's role in the workspace */
  workspaceRole: WorkspaceRole;
  /** Whether the channel is the general channel (cannot be deleted) */
  isGeneralChannel: boolean;
  /** Whether the channel is muted */
  isMuted?: boolean;
  /** Callback when delete succeeds */
  onDeleteSuccess?: () => void;
}

/**
 * Context menu for channel actions.
 *
 * Shows different options based on user's permissions:
 * - Channel owner, channel admin, or workspace owner can delete the channel
 * - All members can mute/unmute notifications
 * - The "general" channel cannot be deleted
 */
export function ChannelContextMenu({
  channelId,
  channelName,
  channelDisplayName,
  workspaceId,
  channelRole,
  workspaceRole,
  isGeneralChannel,
  isMuted = false,
  onDeleteSuccess,
}: ChannelContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Can delete if: (channel owner OR channel admin OR workspace owner) AND not general channel
  const canDelete =
    !isGeneralChannel &&
    (channelRole === ChannelRole.OWNER ||
      channelRole === ChannelRole.ADMIN ||
      workspaceRole === WorkspaceRole.OWNER);

  // Check if there are any menu items to show
  // When adding new menu items, update this condition
  const hasMenuItems = canDelete;

  const displayName = channelDisplayName || channelName;

  // Don't render the menu button if there are no items to show
  if (!hasMenuItems) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label="Channel options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 bg-dropdown text-dropdown-foreground"
        >
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Channel
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <DeleteChannelDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        channelId={channelId}
        channelName={displayName}
        workspaceId={workspaceId}
        onSuccess={onDeleteSuccess}
      />
    </>
  );
}
