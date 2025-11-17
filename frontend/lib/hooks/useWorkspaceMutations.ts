/**
 * React Query mutations for workspace operations
 * Handles creating, updating, and deleting workspaces
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkspace } from "@/lib/api/workspace";
import { workspaceKeys } from "@/lib/hooks/useWorkspaces";
import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
} from "@/types/workspace";
import { toast } from "sonner";

/**
 * Hook for creating a new workspace
 *
 * Automatically:
 * - Manages loading/error states
 * - Invalidates workspace cache on success
 * - Shows error toast on failure
 * - Returns the created workspace data
 *
 * @example
 * ```tsx
 * function CreateWorkspaceForm() {
 *   const createMutation = useCreateWorkspace();
 *
 *   const handleSubmit = (data: CreateWorkspaceRequest) => {
 *     createMutation.mutate(data, {
 *       onSuccess: (response) => {
 *         console.log('Created:', response.data.id);
 *         closeModal();
 *       }
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input {...} />
 *       <button disabled={createMutation.isPending}>
 *         {createMutation.isPending ? 'Creating...' : 'Create'}
 *       </button>
 *       {createMutation.isError && <p>{createMutation.error.message}</p>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => createWorkspace(data),

    onSuccess: (response) => {
      // Invalidate and refetch workspace memberships to include the new workspace
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.memberships(),
      });

      // Show success toast
      toast.success("Workspace created successfully!");
    },

    onError: (error: any) => {
      // Show error toast
      const errorMessage =
        error?.message || "Failed to create workspace. Please try again.";
      toast.error(errorMessage);
      console.error("Error creating workspace:", error);
    },

    // Optional: Retry failed mutations
    retry: 1,

    // Optional: Add optimistic updates (advanced)
    // onMutate: async (newWorkspace) => {
    //   // Cancel outgoing refetches
    //   await queryClient.cancelQueries({ queryKey: workspaceKeys.memberships() });
    //
    //   // Snapshot previous value
    //   const previousWorkspaces = queryClient.getQueryData(workspaceKeys.memberships());
    //
    //   // Optimistically update to show new workspace immediately
    //   queryClient.setQueryData(workspaceKeys.memberships(), (old: any) => ({
    //     ...old,
    //     data: {
    //       ...old.data,
    //       workspaces: [...old.data.workspaces, {
    //         id: 'temp-id',
    //         ...newWorkspace,
    //         memberCount: 1,
    //         userRole: 'owner',
    //       }]
    //     }
    //   }));
    //
    //   // Return context with previous value
    //   return { previousWorkspaces };
    // },

    // onError: (err, newWorkspace, context) => {
    //   // Rollback on error
    //   if (context?.previousWorkspaces) {
    //     queryClient.setQueryData(workspaceKeys.memberships(), context.previousWorkspaces);
    //   }
    // },
  });
}

/**
 * Hook for updating an existing workspace
 * (Placeholder for future implementation)
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateWorkspaceRequest>;
    }) => {
      // TODO: Implement update API call
      throw new Error("Not implemented yet");
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success("Workspace updated successfully!");
    },

    onError: (error: any) => {
      toast.error(error?.message || "Failed to update workspace");
    },
  });
}

/**
 * Hook for deleting a workspace
 * (Placeholder for future implementation)
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      // TODO: Implement delete API call
      throw new Error("Not implemented yet");
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success("Workspace deleted successfully!");
    },

    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete workspace");
    },
  });
}
