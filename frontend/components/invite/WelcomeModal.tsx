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
import { CheckCircle2 } from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  channelCount: number;
}

export function WelcomeModal({
  open,
  onClose,
  workspaceName,
  channelCount,
}: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <DialogTitle>Welcome to {workspaceName}!</DialogTitle>
          </div>
          <DialogDescription>
            You've successfully joined the workspace and have been added to{" "}
            {channelCount} {channelCount === 1 ? "channel" : "channels"}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            You can now start collaborating with your team. Select a channel
            from the sidebar to begin messaging.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
