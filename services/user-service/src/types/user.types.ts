// User-related types and interfaces

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: "ONLINE" | "OFFLINE" | "AWAY" | "BUSY";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
  display_name: string;
}

export interface CreateUserResponse {
  id: string;
  email: string;
  username: string;
  display_name: string;
  status: "ONLINE" | "OFFLINE" | "AWAY" | "BUSY";
  created_at: Date;
}

export type UserStatus = "ONLINE" | "OFFLINE" | "AWAY" | "BUSY";

// Error types for user service operations
export interface UserServiceErrorResponse {
  error: {
    message: string;
    code: string;
  };
}
