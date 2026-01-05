"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { channelFormSchema, type ChannelFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Check,
  X,
  AlertCircle,
  Lock,
  Hash,
  ArrowLeft,
} from "lucide-react";
import { checkChannelName } from "@/lib/api/channel";
import { useCreateChannel } from "@/lib/hooks/useChannelMutations";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { CreateChannelRequest, ChannelType } from "@/types/workspace";
import { MemberSelector } from "./MemberSelector";

interface CreateChannelPanelProps {
  workspaceId: string;
  onSuccess?: (channelId: string, channelName: string) => void;
  onCancel: () => void;
}

export function CreateChannelPanel({
  workspaceId,
  onSuccess,
  onCancel,
}: CreateChannelPanelProps) {
  // React Hook Form setup
  const form = useForm<ChannelFormData>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      displayName: "",
      name: "",
      description: "",
      type: "public",
    },
    mode: "onChange",
  });

  // State for name availability check
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  // State for private channel member selection
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

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

  // Reset member selection when switching back to public
  useEffect(() => {
    if (channelType === "public") {
      setSelectedMemberIds([]);
    }
  }, [channelType]);

  // Auto-generate name from displayName
  useEffect(() => {
    if (displayName) {
      const generatedName = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      form.setValue("name", generatedName, { shouldValidate: true });
      setNameAvailable(null);
    }
  }, [displayName]);

  // Debounced name availability check
  useEffect(() => {
    if (!channelName || form.formState.errors.name || !workspaceId) {
      setNameAvailable(null);
      return;
    }

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
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [channelName, workspaceId]);

  // Handle form submission
  const onSubmit = async (data: ChannelFormData) => {
    if (nameAvailable === false) {
      form.setError("name", {
        type: "manual",
        message: "This channel name is already taken",
      });
      return;
    }

    if (isCheckingName || nameAvailable === null) {
      return;
    }

    const channelData: CreateChannelRequest = {
      workspaceId,
      name: data.name.trim(),
      displayName: data.displayName.trim(),
      description: data.description?.trim() || undefined,
      type: data.type as ChannelType,
      participants: data.type === "private" ? selectedMemberIds : undefined,
    };

    createChannelMutation.mutate(channelData, {
      onSuccess: (response) => {
        onSuccess?.(
          response.data.id,
          response.data.displayName || response.data.name
        );
        form.reset();
        setNameAvailable(null);
        setSelectedMemberIds([]);
      },
    });
  };

  const handleCancel = () => {
    form.reset();
    setNameAvailable(null);
    setSelectedMemberIds([]);
    onCancel();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={createChannelMutation.isPending}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">Create New Channel</h2>
            {selectedWorkspaceDisplayName && (
              <p className="text-sm text-muted-foreground mt-1">
                in{" "}
                <span className="font-semibold">
                  {selectedWorkspaceDisplayName}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-2xl mx-auto p-6"
        >
          <div className="space-y-6">
            {/* Channel Type Selector - Side by Side on Larger Screens */}
            <div className="space-y-2">
              <Label>
                Channel Type <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Public Channel Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors flex-1 ${
                    channelType === "public"
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    value="public"
                    {...form.register("type")}
                    className="sr-only"
                  />
                  <Hash className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Public</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      All workspace members can join
                    </p>
                  </div>
                </label>

                {/* Private Channel Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors flex-1 ${
                    channelType === "private"
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    value="private"
                    {...form.register("type")}
                    className="sr-only"
                  />
                  <Lock className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Private</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Only selected members can access
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Member Selection - Only for Private Channels */}
            {channelType === "private" && (
              <div className="space-y-2">
                <Label>Select Members</Label>
                <MemberSelector
                  workspaceId={workspaceId}
                  selectedMemberIds={selectedMemberIds}
                  onSelectionChange={setSelectedMemberIds}
                />
              </div>
            )}

            {/* Display Name Field */}
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

            {/* Channel Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Channel Name <span className="text-destructive">*</span>
              </Label>
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
              {form.formState.errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" />
                  {form.formState.errors.name.message}
                </p>
              )}
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

            {/* Description Field */}
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

          {/* Form Actions - Fixed at bottom */}
          <div className="flex gap-3 justify-end pt-6 mt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createChannelMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createChannelMutation.isPending || !!form.formState.errors.name
              }
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
          </div>
        </form>
      </div>
    </div>
  );
}
