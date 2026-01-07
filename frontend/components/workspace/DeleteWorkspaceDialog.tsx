"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useDeleteWorkspace } from "@/lib/hooks/useWorkspaceMutations";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useQueryClient } from "@tanstack/react-query";
import type { GetUserMembershipsResponse } from "@/types/workspace";

interface DeleteWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  onSuccess?: () => void;
}

/**
 * Confirmation dialog for deleting a workspace.
 *
 * Requires the user to type the workspace name to confirm deletion.
 * This prevents accidental deletions of workspaces.
 */
export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  onSuccess,
}: DeleteWorkspaceDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const queryClient = useQueryClient();
  const {
    selectedWorkspaceId,
    clearWorkspaceState,
    setSelectedWorkspace,
    setSelectedChannel,
  } = useWorkspaceStore();

  // Check if confirmation text matches workspace name
  const isConfirmed = confirmationText === workspaceName;

  // Reset confirmation text when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmationText("");
    }
  }, [open]);

  const handleDelete = async () => {
    if (!isConfirmed) return;

    deleteWorkspaceMutation.mutate(workspaceId, {
      onSuccess: () => {
        // Check if the user was viewing the deleted workspace
        const wasViewingDeletedWorkspace = selectedWorkspaceId === workspaceId;

        if (wasViewingDeletedWorkspace) {
          // Get available workspaces from cache (before socket event removes it)
          const cacheKey = ["workspaces", "memberships", "with-channels"];
          const cachedData =
            queryClient.getQueryData<GetUserMembershipsResponse>(cacheKey);

          const availableWorkspaces = cachedData?.data?.workspaces?.filter(
            (w) => w.id !== workspaceId
          );

          if (availableWorkspaces && availableWorkspaces.length > 0) {
            // Switch to the first available workspace's general channel
            const firstWorkspace = availableWorkspaces[0];
            const generalChannel = firstWorkspace.channels?.find(
              (c) => c.name === "general"
            );

            setSelectedWorkspace(
              firstWorkspace.id,
              firstWorkspace.displayName || firstWorkspace.name
            );

            if (generalChannel) {
              setSelectedChannel(
                generalChannel.id,
                generalChannel.displayName || generalChannel.name
              );
            } else {
              setSelectedChannel(null);
            }
          } else {
            // No other workspaces available - clear all state
            clearWorkspaceState();
          }
        }

        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Workspace
          </DialogTitle>
          <DialogDescription className="text-left">
            This action cannot be undone. This will permanently delete the{" "}
            <span className="font-semibold text-foreground">
              {workspaceName}
            </span>{" "}
            workspace, all of its channels, and all messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">
              <strong>Warning:</strong> This will permanently delete:
            </p>
            <ul className="text-sm text-destructive mt-2 ml-4 list-disc space-y-1">
              <li>All channels in this workspace</li>
              <li>All messages in all channels</li>
              <li>All workspace members will lose access</li>
              <li>All workspace settings and data</li>
            </ul>
            <p className="text-sm text-destructive mt-2">
              Members will be notified that the workspace has been deleted.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm">
              Type{" "}
              <span className="font-mono font-semibold">{workspaceName}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={workspaceName}
              className="font-mono"
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteWorkspaceMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || deleteWorkspaceMutation.isPending}
          >
            {deleteWorkspaceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
