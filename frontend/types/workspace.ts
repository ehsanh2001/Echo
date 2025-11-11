/**
 * Workspace-related TypeScript types
 * Matches backend types from workspace-channel-service
 */

export interface CreateWorkspaceRequest {
  name: string;
  displayName?: string;
  description?: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  maxMembers: number | null;
  isPublic: boolean;
  vanityUrl: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

export interface CheckNameAvailabilityResponse {
  success: boolean;
  data: {
    name: string;
    isAvailable: boolean;
  };
  timestamp: string;
}

export interface CreateWorkspaceResponse {
  success: boolean;
  data: WorkspaceResponse;
  message: string;
  timestamp: string;
}

export interface WorkspaceError {
  success: false;
  message: string;
  code: string;
  statusCode?: number;
  details?: Record<string, any>;
}
