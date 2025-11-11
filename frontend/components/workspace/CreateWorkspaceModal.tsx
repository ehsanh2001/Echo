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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, AlertCircle } from "lucide-react";
import { createWorkspace, checkWorkspaceName } from "@/lib/api/workspace";
import { CreateWorkspaceRequest } from "@/types/workspace";
import { toast } from "sonner";

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (workspaceId: string) => void;
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkspaceModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [nameError, setNameError] = useState<string>("");
  const [displayNameError, setDisplayNameError] = useState<string>("");

  // Auto-generate name from displayName
  useEffect(() => {
    if (displayName) {
      const generatedName = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setName(generatedName);
      setNameAvailable(null); // Reset availability when name changes
    } else {
      setName("");
    }
  }, [displayName]);

  // Validate name for spaces
  const validateName = (value: string): string => {
    if (value.includes(" ")) {
      return "Workspace name cannot contain spaces. Use hyphens instead.";
    }
    if (value && !/^[a-z0-9-]+$/.test(value)) {
      return "Workspace name can only contain lowercase letters, numbers, and hyphens.";
    }
    return "";
  };

  // Check name availability
  const handleCheckAvailability = async () => {
    if (!name) {
      setNameError("Workspace name is required");
      return;
    }

    const validationError = validateName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setIsCheckingName(true);
    setNameError("");

    try {
      const response = await checkWorkspaceName(name);
      setNameAvailable(response.data.isAvailable);
      if (!response.data.isAvailable) {
        setNameError("This workspace name is already taken");
      }
    } catch (error: any) {
      toast.error("Failed to check name availability");
      console.error("Error checking name:", error);
    } finally {
      setIsCheckingName(false);
    }
  };

  // Handle name field blur
  const handleNameBlur = () => {
    if (name) {
      handleCheckAvailability();
    }
  };

  // Handle name change
  const handleNameChange = (value: string) => {
    setName(value);
    setNameAvailable(null); // Reset availability
    const validationError = validateName(value);
    setNameError(validationError);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate display name
    if (!displayName.trim()) {
      setDisplayNameError("Display name is required");
      return;
    }

    // Validate name
    if (!name.trim()) {
      setNameError("Workspace name is required");
      return;
    }

    const validationError = validateName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    // Check availability if not already checked
    if (nameAvailable === null) {
      await handleCheckAvailability();
      return; // Will need to submit again after checking
    }

    if (!nameAvailable) {
      setNameError("This workspace name is already taken");
      return;
    }

    setIsSubmitting(true);

    try {
      const workspaceData: CreateWorkspaceRequest = {
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      };

      const response = await createWorkspace(workspaceData);

      // Success! Call onSuccess callback
      onSuccess?.(response.data.id);

      // Reset form
      resetForm();

      // Close modal
      onOpenChange(false);
    } catch (error: any) {
      // Backend errors shown via toast
      const errorMessage =
        error?.message || "Failed to create workspace. Please try again.";
      toast.error(errorMessage);
      console.error("Error creating workspace:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setDisplayName("");
    setName("");
    setDescription("");
    setNameAvailable(null);
    setNameError("");
    setDisplayNameError("");
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Modal Header */}
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Create a workspace to collaborate with your team. A default
            &quot;general&quot; channel will be created automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Workspace Creation Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Display Name Field - User-friendly name shown in UI */}
            <div className="space-y-2">
              <Label htmlFor="displayName">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                placeholder="My Awesome Team"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setDisplayNameError("");
                }}
                className={displayNameError ? "border-destructive" : ""}
              />
              {/* Display Name Error Message */}
              {displayNameError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {displayNameError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A friendly name for your workspace
              </p>
            </div>

            {/* Workspace Name Field - Auto-generated URL-friendly identifier */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Workspace Name <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                {/* Name Input with Validation Status */}
                <div className="flex-1 space-y-2">
                  <Input
                    id="name"
                    placeholder="my-awesome-team"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={handleNameBlur}
                    className={nameError ? "border-destructive" : ""}
                  />
                  {/* Name Error Message */}
                  {nameError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {nameError}
                    </p>
                  )}
                  {/* Name Available Success Message */}
                  {nameAvailable === true && !nameError && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Name is available!
                    </p>
                  )}
                </div>
                {/* Check Availability Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckAvailability}
                  disabled={!name || isCheckingName || !!nameError}
                  className="shrink-0"
                  aria-label="Check workspace name availability"
                >
                  {isCheckingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Check"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Unique identifier (lowercase, hyphens only)
              </p>
            </div>

            {/* Description Field - Optional workspace description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this workspace about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Help team members understand the purpose of this workspace
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              aria-label="Cancel workspace creation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !!nameError}
              aria-label="Create new workspace"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
