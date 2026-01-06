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
import { useDeleteChannel } from "@/lib/hooks/useChannelMutations";

interface DeleteChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelName: string;
  workspaceId: string;
  onSuccess?: () => void;
}

/**
 * Confirmation dialog for deleting a channel.
 *
 * Requires the user to type the channel name to confirm deletion.
 * This prevents accidental deletions of channels.
 */
export function DeleteChannelDialog({
  open,
  onOpenChange,
  channelId,
  channelName,
  workspaceId,
  onSuccess,
}: DeleteChannelDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const deleteChannelMutation = useDeleteChannel();

  // Check if confirmation text matches channel name
  const isConfirmed = confirmationText === channelName;

  // Reset confirmation text when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmationText("");
    }
  }, [open]);

  const handleDelete = async () => {
    if (!isConfirmed) return;

    deleteChannelMutation.mutate(
      { workspaceId, channelId },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Channel
          </DialogTitle>
          <DialogDescription className="text-left">
            This action cannot be undone. This will permanently delete the{" "}
            <span className="font-semibold text-foreground">
              #{channelName}
            </span>{" "}
            channel and all of its messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">
              <strong>Warning:</strong> All messages in this channel will be
              permanently deleted. Members will be notified that the channel has
              been removed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm">
              Type{" "}
              <span className="font-mono font-semibold">{channelName}</span> to
              confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={channelName}
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
            disabled={deleteChannelMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || deleteChannelMutation.isPending}
          >
            {deleteChannelMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Channel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
