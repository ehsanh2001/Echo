"use client";

import { useState, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useCreateWorkspaceInvite } from "@/lib/hooks/useInviteMutations";
import { InviteRole, InviteResult } from "@/types/invite";
import { toast } from "sonner";

interface InviteMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string; // Display name for showing in modal title
}

interface EmailInput {
  id: string;
  value: string;
  error: string | null;
}

export function InviteMembersModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: InviteMembersModalProps) {
  // Email inputs state
  const [emails, setEmails] = useState<EmailInput[]>([
    { id: "1", value: "", error: null },
  ]);

  // Form fields state
  const [role, setRole] = useState<InviteRole>("member");
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [customMessage, setCustomMessage] = useState<string>("");

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<InviteResult[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createInviteMutation = useCreateWorkspaceInvite();

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Add new email input
  const handleAddEmail = () => {
    setEmails([
      ...emails,
      { id: Date.now().toString(), value: "", error: null },
    ]);
  };

  // Remove email input
  const handleRemoveEmail = (id: string) => {
    if (emails.length > 1) {
      setEmails(emails.filter((email) => email.id !== id));
    }
  };

  // Update email value
  const handleEmailChange = (id: string, value: string) => {
    setEmails(
      emails.map((email) =>
        email.id === id
          ? {
              ...email,
              value,
              error: value && !validateEmail(value) ? "Invalid email" : null,
            }
          : email
      )
    );
  };

  // Send all invites
  const handleSendInvites = async () => {
    // Validate all emails
    const validEmails = emails.filter((email) => email.value.trim() !== "");

    if (validEmails.length === 0) {
      toast.error("No emails entered", {
        description: "Please enter at least one email address",
      });
      return;
    }

    // Check for invalid emails
    const invalidEmails = validEmails.filter(
      (email) => !validateEmail(email.value)
    );
    if (invalidEmails.length > 0) {
      toast.error("Invalid emails", {
        description: "Please fix the invalid email addresses",
      });
      return;
    }

    // Check for duplicate emails
    const emailValues = validEmails.map((e) => e.value.toLowerCase());
    const uniqueEmails = new Set(emailValues);
    if (emailValues.length !== uniqueEmails.size) {
      toast.error("Duplicate emails", {
        description: "Please remove duplicate email addresses",
      });
      return;
    }

    setIsSending(true);
    setResults([]);
    abortControllerRef.current = new AbortController();

    const inviteResults: InviteResult[] = [];
    let successCount = 0;
    let failCount = 0;

    // Send invites one by one
    for (const email of validEmails) {
      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }

      try {
        await createInviteMutation.mutateAsync({
          workspaceId,
          data: {
            email: email.value.trim(),
            role,
            expiresInDays,
            customMessage: customMessage.trim() || undefined,
          },
        });

        inviteResults.push({
          email: email.value,
          success: true,
        });
        successCount++;
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to send invite";

        inviteResults.push({
          email: email.value,
          success: false,
          error: errorMessage,
        });
        failCount++;
      }

      setResults([...inviteResults]);
    }

    setIsSending(false);

    // Show final toast
    const wasCancelled = abortControllerRef.current?.signal.aborted;
    if (wasCancelled) {
      toast.warning("Invites Cancelled", {
        description: `${successCount} invite(s) sent successfully, ${
          validEmails.length - successCount
        } cancelled`,
      });
    } else if (failCount === 0) {
      toast.success("Invites Sent", {
        description: `${successCount} invite(s) sent successfully`,
      });
      // Close modal after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      toast.error("Some Invites Failed", {
        description: `${successCount} sent, ${failCount} failed`,
      });
    }
  };

  // Cancel sending
  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsSending(false);
  };

  // Close modal and reset
  const handleClose = () => {
    setEmails([{ id: "1", value: "", error: null }]);
    setRole("member");
    setExpiresInDays(7);
    setCustomMessage("");
    setResults([]);
    setIsSending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <DialogHeader>
          <DialogTitle>Invite Members to {workspaceName}</DialogTitle>
          <DialogDescription>
            Send invitations to join this workspace. Invited users will receive
            an email with a link to accept.
          </DialogDescription>
        </DialogHeader>

        {/* Invite Form */}
        <div className="space-y-4 py-4">
          {/* Email Inputs */}
          <div className="space-y-2">
            <Label>
              Email Addresses <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {emails.map((email, index) => (
                <div key={email.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={email.value}
                      onChange={(e) =>
                        handleEmailChange(email.id, e.target.value)
                      }
                      className={email.error ? "border-destructive" : ""}
                      disabled={isSending}
                    />
                    {email.error && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {email.error}
                      </p>
                    )}
                    {/* Show result if available */}
                    {results[index] && (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        {results[index].success ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-green-600">Sent</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-destructive" />
                            <span className="text-destructive">
                              {results[index].error}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEmail(email.id)}
                      disabled={isSending}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEmail}
              disabled={isSending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Email
            </Button>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              disabled={isSending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="guest">Guest</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {role === "member" && "Standard access to workspace and channels"}
              {role === "admin" &&
                "Can manage workspace settings and invite members"}
              {role === "guest" && "Limited access to specific channels"}
            </p>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires">Invite Expiration</Label>
            <select
              id="expires"
              aria-label="Invite Expiration"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
              disabled={isSending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to the invitation..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isSending}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {customMessage.length}/500
            </p>
          </div>
        </div>

        {/* Form Actions */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={isSending ? handleCancel : handleClose}
            disabled={!isSending && createInviteMutation.isPending}
          >
            {isSending ? "Cancel" : "Close"}
          </Button>
          <Button
            type="button"
            onClick={handleSendInvites}
            disabled={isSending || emails.every((e) => !e.value.trim())}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending ({results.length}/
                {emails.filter((e) => e.value.trim()).length})...
              </>
            ) : (
              "Send Invites"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
