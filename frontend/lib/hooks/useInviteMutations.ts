/**
 * Invite-related React Query mutations
 * Handles creating workspace invites with optimistic updates
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkspaceInvite, acceptWorkspaceInvite } from "@/lib/api/invite";
import {
  CreateInviteRequest,
  CreateInviteResponse,
  AcceptInviteRequest,
  AcceptInviteResponse,
} from "@/types/invite";
import { toast } from "sonner";
import { workspaceKeys } from "./useWorkspaces";

interface CreateInviteMutationVariables {
  workspaceId: string;
  data: CreateInviteRequest;
}

/**
 * Hook for creating workspace invites
 *
 * @example
 * ```tsx
 * const createInvite = useCreateWorkspaceInvite();
 *
 * createInvite.mutate({
 *   workspaceId: "workspace-123",
 *   data: {
 *     email: "user@example.com",
 *     role: "member",
 *     expiresInDays: 7
 *   }
 * });
 * ```
 */
export function useCreateWorkspaceInvite() {
  return useMutation<
    CreateInviteResponse,
    Error,
    CreateInviteMutationVariables
  >({
    mutationFn: ({ workspaceId, data }) =>
      createWorkspaceInvite(workspaceId, data),
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send invite";

      toast.error("Invite Failed", {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook for accepting workspace invites
 * Invalidates workspace memberships cache after successful acceptance
 *
 * @example
 * ```tsx
 * const acceptInvite = useAcceptWorkspaceInvite();
 *
 * acceptInvite.mutate({
 *   token: "invite-token-from-url"
 * });
 * ```
 */
export function useAcceptWorkspaceInvite() {
  const queryClient = useQueryClient();

  return useMutation<AcceptInviteResponse, Error, AcceptInviteRequest>({
    mutationFn: (data) => acceptWorkspaceInvite(data),
    onSuccess: () => {
      // Invalidate workspace memberships to refetch with new workspace
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.memberships(),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membershipsWithChannels(),
      });
    },
  });
}
