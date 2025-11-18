"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { channelFormSchema, type ChannelFormData } from "@/lib/validations";
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
import { Loader2, Check, X, AlertCircle, Lock, Hash } from "lucide-react";
import { checkChannelName } from "@/lib/api/channel";
import { useCreateChannel } from "@/lib/hooks/useChannelMutations";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { CreateChannelRequest, ChannelType } from "@/types/workspace";

interface CreateChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: (channelId: string, channelName: string) => void;
}

export function CreateChannelModal({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: CreateChannelModalProps) {
  // React Hook Form setup
  const form = useForm<ChannelFormData>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      displayName: "",
      name: "",
      description: "",
      type: "public",
    },
    mode: "onChange", // Validate on change for better UX
  });

  // State for name availability check
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  // Use React Query mutation for creating channel
  const createChannelMutation = useCreateChannel();

  // Get workspace display name from Zustand store
  const selectedWorkspaceDisplayName = useWorkspaceStore(
    (state) => state.selectedWorkspaceDisplayName
  );

  // Watch form fields
  const displayName = form.watch("displayName");
  const channelName = form.watch("name");
  const channelType = form.watch("type");

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
    // Don't check if name is empty, has validation errors, or no workspace selected
    if (!channelName || form.formState.errors.name || !workspaceId) {
      setNameAvailable(null);
      return;
    }

    // Debounce the availability check
    const timeoutId = setTimeout(async () => {
      setIsCheckingName(true);

      try {
        const response = await checkChannelName(workspaceId, channelName);
        setNameAvailable(response.data.isAvailable);
        if (!response.data.isAvailable) {
          form.setError("name", {
            type: "manual",
            message: "This channel name is already taken",
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
  }, [channelName, workspaceId]);

  // Handle form submission
  const onSubmit = async (data: ChannelFormData) => {
    // Don't submit if name is not available
    if (nameAvailable === false) {
      form.setError("name", {
        type: "manual",
        message: "This channel name is already taken",
      });
      return;
    }

    // Don't submit if still checking availability
    if (isCheckingName || nameAvailable === null) {
      return;
    }

    const channelData: CreateChannelRequest = {
      workspaceId,
      name: data.name.trim(),
      displayName: data.displayName.trim(),
      description: data.description?.trim() || undefined,
      type: data.type as ChannelType,
    };

    createChannelMutation.mutate(channelData, {
      onSuccess: (response) => {
        // Success! Call onSuccess callback with channel ID and name
        onSuccess?.(
          response.data.id,
          response.data.displayName || response.data.name
        );

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
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Modal Header */}
        <DialogHeader>
          <DialogTitle>Create New Channel</DialogTitle>
          <DialogDescription>
            {selectedWorkspaceDisplayName ? (
              <>
                Create a channel in{" "}
                <span className="font-semibold">
                  {selectedWorkspaceDisplayName}
                </span>{" "}
                for team discussions and collaboration.
              </>
            ) : (
              "Create a channel for team discussions and collaboration."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Channel Creation Form */}
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            {/* Channel Type Selector */}
            <div className="space-y-2">
              <Label>
                Channel Type <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2">
                {/* Public Channel Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    channelType === "public"
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    value="public"
                    {...form.register("type")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <Hash className="h-4 w-4" />
                      Public
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Anyone in the workspace can join and see messages
                    </p>
                  </div>
                </label>

                {/* Private Channel Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    channelType === "private"
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    value="private"
                    {...form.register("type")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <Lock className="h-4 w-4" />
                      Private
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Only invited members can access this channel
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Display Name Field - User-friendly name shown in UI */}
            <div className="space-y-2">
              <Label htmlFor="displayName">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                placeholder="General Discussion"
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
                A friendly name for your channel
              </p>
            </div>

            {/* Channel Name Field - Auto-generated URL-friendly identifier */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Channel Name <span className="text-destructive">*</span>
              </Label>
              {/* Name Input with Validation Status */}
              <div className="relative">
                <Input
                  id="name"
                  placeholder="general-discussion"
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
                Unique identifier (lowercase, hyphens, underscores)
              </p>
            </div>

            {/* Description Field - Optional channel description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this channel about?"
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
                Help members understand the purpose of this channel
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createChannelMutation.isPending}
              aria-label="Cancel channel creation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createChannelMutation.isPending || !!form.formState.errors.name
              }
              aria-label="Create new channel"
            >
              {createChannelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Channel"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
