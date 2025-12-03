/**
 * Invite-related React Query mutations
 * Handles creating workspace invites with optimistic updates
 */

import { useMutation } from "@tanstack/react-query";
import { createWorkspaceInvite } from "@/lib/api/invite";
import { CreateInviteRequest, CreateInviteResponse } from "@/types/invite";
import { toast } from "sonner";

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
