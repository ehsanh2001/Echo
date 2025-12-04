"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export function ErrorModal({ open, onClose, message }: ErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <DialogTitle>Failed to Accept Invitation</DialogTitle>
          </div>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            {message.toLowerCase().includes("expired") ||
            message.toLowerCase().includes("not found")
              ? "This invitation link may have expired or is no longer valid. Please contact the workspace owner for a new invitation."
              : message.toLowerCase().includes("already a member")
                ? "You're already a member of this workspace. You can access it from the workspace list in the sidebar."
                : "Please try again or contact the workspace owner if the problem persists."}
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
