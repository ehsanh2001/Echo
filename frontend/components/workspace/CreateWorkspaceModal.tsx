"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workspaceFormSchema, type WorkspaceFormData } from "@/lib/validations";
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
import { checkWorkspaceName } from "@/lib/api/workspace";
import { useCreateWorkspace } from "@/lib/hooks/useWorkspaceMutations";
import { CreateWorkspaceRequest } from "@/types/workspace";

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
  // React Hook Form setup
  const form = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      displayName: "",
      name: "",
      description: "",
    },
    mode: "onChange", // Validate on change for better UX
  });

  // State for name availability check
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  // Use React Query mutation for creating workspace
  const createWorkspaceMutation = useCreateWorkspace();

  // Watch both displayName and name fields
  const displayName = form.watch("displayName");
  const workspaceName = form.watch("name");

  // Auto-generate name from displayName
  useEffect(() => {
    if (displayName) {
      const generatedName = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      form.setValue("name", generatedName, { shouldValidate: true });
      setNameAvailable(null); // Reset availability when name changes
    }
  }, [displayName]);

  // Debounced name availability check
  useEffect(() => {
    // Don't check if name is empty or has validation errors
    if (!workspaceName || form.formState.errors.name) {
      setNameAvailable(null);
      return;
    }

    // Debounce the availability check
    const timeoutId = setTimeout(async () => {
      setIsCheckingName(true);

      try {
        const response = await checkWorkspaceName(workspaceName);
        setNameAvailable(response.data.isAvailable);
        if (!response.data.isAvailable) {
          form.setError("name", {
            type: "manual",
            message: "This workspace name is already taken",
          });
        } else {
          // Clear the error if name is available
          if (form.formState.errors.name?.type === "manual") {
            form.clearErrors("name");
          }
        }
      } catch (error) {
        console.error("Error checking name:", error);
        setNameAvailable(null);
      } finally {
        setIsCheckingName(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [workspaceName]);

  // Handle form submission
  const onSubmit = async (data: WorkspaceFormData) => {
    // Don't submit if name is not available
    if (nameAvailable === false) {
      form.setError("name", {
        type: "manual",
        message: "This workspace name is already taken",
      });
      return;
    }

    // Don't submit if still checking availability
    if (isCheckingName || nameAvailable === null) {
      return;
    }

    const workspaceData: CreateWorkspaceRequest = {
      name: data.name.trim(),
      displayName: data.displayName.trim(),
      description: data.description?.trim() || undefined,
    };

    createWorkspaceMutation.mutate(workspaceData, {
      onSuccess: (response) => {
        // Success! Call onSuccess callback
        onSuccess?.(response.data.id);

        // Reset form
        form.reset();
        setNameAvailable(null);

        // Close modal
        onOpenChange(false);
      },
    });
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setNameAvailable(null);
    }
  }, [open, form]);

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
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            {/* Display Name Field - User-friendly name shown in UI */}
            <div className="space-y-2">
              <Label htmlFor="displayName">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                placeholder="My Awesome Team"
                {...form.register("displayName")}
                className={
                  form.formState.errors.displayName ? "border-destructive" : ""
                }
              />
              {/* Display Name Error Message */}
              {form.formState.errors.displayName && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {form.formState.errors.displayName.message}
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
              {/* Name Input with Validation Status */}
              <div className="relative">
                <Input
                  id="name"
                  placeholder="my-awesome-team"
                  {...form.register("name")}
                  className={
                    form.formState.errors.name
                      ? "border-destructive pr-10"
                      : "pr-10"
                  }
                />
                {/* Loading/Success Indicator inside input */}
                {isCheckingName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {nameAvailable === true && !form.formState.errors.name && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                )}
              </div>
              {/* Name Error Message */}
              {form.formState.errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" />
                  {form.formState.errors.name.message}
                </p>
              )}
              {/* Name Available Success Message */}
              {nameAvailable === true && !form.formState.errors.name && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Name is available!
                </p>
              )}
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
                {...form.register("description")}
                rows={3}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {form.formState.errors.description.message}
                </p>
              )}
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
              disabled={createWorkspaceMutation.isPending}
              aria-label="Cancel workspace creation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createWorkspaceMutation.isPending ||
                !!form.formState.errors.name
              }
              aria-label="Create new workspace"
            >
              {createWorkspaceMutation.isPending ? (
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
