import "reflect-metadata";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WorkspaceService } from "../../src/services/WorkspaceService";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "../../src/interfaces/repositories/IChannelRepository";
import { UserServiceClient } from "../../src/services/userServiceClient";
import { CreateWorkspaceRequest, UserInfo } from "../../src/types";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { Workspace } from "@prisma/client";

describe("WorkspaceService (Unit Tests)", () => {
  let workspaceService: WorkspaceService;
  let mockWorkspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let mockChannelRepository: jest.Mocked<IChannelRepository>;
  let mockUserServiceClient: jest.Mocked<UserServiceClient>;

  const mockWorkspace: Workspace = {
    id: "workspace-123",
    name: "test-workspace",
    displayName: "Test Workspace",
    description: "Test description",
    ownerId: "user-123",
    isArchived: false,
    maxMembers: null,
    isPublic: true,
    vanityUrl: null,
    settings: {},
    createdAt: new Date("2023-01-01T00:00:00.000Z"),
    updatedAt: new Date("2023-01-01T00:00:00.000Z"),
  };

  const mockUserInfo: UserInfo = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    displayName: "Test User",
    bio: null,
    avatarUrl: null,
    createdAt: new Date("2023-01-01T00:00:00.000Z"),
    lastSeen: null,
    roles: ["user"],
  };

  beforeEach(() => {
    // Create mock repositories and client
    mockWorkspaceRepository = {
      create: jest.fn(),
      findByName: jest.fn(),
      findById: jest.fn(),
      addMember: jest.fn(),
    } as any;

    mockChannelRepository = {
      create: jest.fn(),
      createInTransaction: jest.fn(),
      findById: jest.fn(),
      addMember: jest.fn(),
    } as any;

    mockUserServiceClient = {
      checkUserExistsById: jest.fn(),
    } as any;

    // Create service with mocked dependencies
    workspaceService = new WorkspaceService(
      mockWorkspaceRepository,
      mockChannelRepository,
      mockUserServiceClient
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("createWorkspace", () => {
    const validRequest: CreateWorkspaceRequest = {
      name: "Test-Workspace",
      displayName: "Test Workspace",
      description: "A test workspace",
    };

    it("should create a workspace with all fields provided", async () => {
      // Arrange
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      const result = await workspaceService.createWorkspace(
        "user-123",
        validRequest
      );

      // Assert
      expect(mockUserServiceClient.checkUserExistsById).toHaveBeenCalledWith(
        "user-123"
      );
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        {
          name: "test-workspace", // Should be sanitized (lowercase)
          displayName: "Test Workspace",
          description: "A test workspace",
          ownerId: "user-123",
          settings: {},
        },
        "user-123"
      );
      expect(result).toEqual({
        id: mockWorkspace.id,
        name: mockWorkspace.name,
        displayName: mockWorkspace.displayName,
        description: mockWorkspace.description,
        ownerId: mockWorkspace.ownerId,
        isArchived: mockWorkspace.isArchived,
        maxMembers: mockWorkspace.maxMembers,
        isPublic: mockWorkspace.isPublic,
        vanityUrl: mockWorkspace.vanityUrl,
        settings: mockWorkspace.settings,
        createdAt: mockWorkspace.createdAt,
        updatedAt: mockWorkspace.updatedAt,
      });
    });

    it("should create a workspace with minimal fields (no displayName, no description)", async () => {
      // Arrange
      const minimalRequest: CreateWorkspaceRequest = {
        name: "minimal-workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue({
        ...mockWorkspace,
        name: "minimal-workspace",
        displayName: "Minimal Workspace", // Generated from name
        description: null, // No description provided
      });

      // Act
      const result = await workspaceService.createWorkspace(
        "user-123",
        minimalRequest
      );

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        {
          name: "minimal-workspace",
          displayName: "Minimal Workspace", // Auto-generated
          description: null,
          ownerId: "user-123",
          settings: {},
        },
        "user-123"
      );
      expect(result.displayName).toBe("Minimal Workspace");
      expect(result.description).toBeNull();
    });

    it("should sanitize workspace name (trim and lowercase)", async () => {
      // Arrange
      const requestWithWhitespace: CreateWorkspaceRequest = {
        name: "  My-WORKSPACE  ",
        displayName: "My Workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", requestWithWhitespace);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-workspace", // Trimmed and lowercased
        }),
        "user-123"
      );
    });

    it("should generate display name from workspace name if not provided", async () => {
      // Arrange
      const requestWithoutDisplayName: CreateWorkspaceRequest = {
        name: "my-awesome.workspace_name",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace(
        "user-123",
        requestWithoutDisplayName
      );

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "My Awesome Workspace Name", // Converted dots/underscores to spaces, title case
        }),
        "user-123"
      );
    });

    it("should use provided display name even if workspace name could generate one", async () => {
      // Arrange
      const requestWithBoth: CreateWorkspaceRequest = {
        name: "my-workspace",
        displayName: "Custom Display Name",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", requestWithBoth);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "Custom Display Name", // Uses provided, not generated
        }),
        "user-123"
      );
    });

    it("should trim empty description to null", async () => {
      // Arrange
      const requestWithEmptyDescription: CreateWorkspaceRequest = {
        name: "test-workspace",
        description: "   ", // Only whitespace
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace(
        "user-123",
        requestWithEmptyDescription
      );

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null, // Empty string becomes null
        }),
        "user-123"
      );
    });

    it("should throw validation error for empty workspace name", async () => {
      // Arrange
      const invalidRequest: CreateWorkspaceRequest = {
        name: "", // Empty name
      };

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", invalidRequest)
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should throw validation error for invalid workspace name format", async () => {
      // Arrange
      const invalidRequest: CreateWorkspaceRequest = {
        name: "invalid name with spaces", // Spaces not allowed
      };

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", invalidRequest)
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should proceed when user service is unavailable (resilient fallback)", async () => {
      // Arrange
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(null); // Service unavailable
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      const result = await workspaceService.createWorkspace(
        "user-123",
        validRequest
      );

      // Assert
      expect(mockUserServiceClient.checkUserExistsById).toHaveBeenCalledWith(
        "user-123"
      );
      expect(mockWorkspaceRepository.create).toHaveBeenCalled(); // Should proceed anyway
      expect(result).toBeDefined();
    });

    it("should throw error when user does not exist", async () => {
      // Arrange
      mockUserServiceClient.checkUserExistsById.mockRejectedValue(
        WorkspaceChannelServiceError.notFound("User not found", "user")
      );

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("invalid-user", validRequest)
      ).rejects.toThrow(WorkspaceChannelServiceError);
      expect(mockWorkspaceRepository.create).not.toHaveBeenCalled();
    });

    it("should throw database error when repository fails", async () => {
      // Arrange
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", validRequest)
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should preserve WorkspaceChannelServiceError thrown by repository", async () => {
      // Arrange
      const customError = WorkspaceChannelServiceError.conflict(
        "Workspace name already exists",
        { field: "name", value: "test-workspace" }
      );
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockRejectedValue(customError);

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", validRequest)
      ).rejects.toThrow(customError);
    });
  });

  describe("isNameAvailable", () => {
    it("should return true when workspace name is available", async () => {
      // Arrange
      mockWorkspaceRepository.findByName.mockResolvedValue(null);

      // Act
      const result = await workspaceService.isNameAvailable("new-workspace");

      // Assert
      expect(mockWorkspaceRepository.findByName).toHaveBeenCalledWith(
        "new-workspace"
      );
      expect(result).toBe(true);
    });

    it("should return false when workspace name is taken", async () => {
      // Arrange
      mockWorkspaceRepository.findByName.mockResolvedValue(mockWorkspace);

      // Act
      const result = await workspaceService.isNameAvailable("test-workspace");

      // Assert
      expect(mockWorkspaceRepository.findByName).toHaveBeenCalledWith(
        "test-workspace"
      );
      expect(result).toBe(false);
    });

    it("should sanitize name before checking availability", async () => {
      // Arrange
      mockWorkspaceRepository.findByName.mockResolvedValue(null);

      // Act
      await workspaceService.isNameAvailable("  Test-WORKSPACE  ");

      // Assert
      expect(mockWorkspaceRepository.findByName).toHaveBeenCalledWith(
        "test-workspace" // Trimmed and lowercased
      );
    });

    it("should throw database error when repository fails", async () => {
      // Arrange
      mockWorkspaceRepository.findByName.mockRejectedValue(
        new Error("Database connection failed")
      );

      // Act & Assert
      await expect(
        workspaceService.isNameAvailable("test-workspace")
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });
  });

  describe("Display Name Generation Logic", () => {
    // These tests focus on the display name generation algorithm
    it("should convert dots to spaces and title case", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "my.awesome.workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "My Awesome Workspace",
        }),
        "user-123"
      );
    });

    it("should convert underscores to spaces and title case", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "my_awesome_workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "My Awesome Workspace",
        }),
        "user-123"
      );
    });

    it("should convert hyphens to spaces and title case", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "my-awesome-workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "My Awesome Workspace",
        }),
        "user-123"
      );
    });

    it("should handle mixed separators", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "my-awesome_workspace.name",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "My Awesome Workspace Name",
        }),
        "user-123"
      );
    });

    it("should handle single word workspace names", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "Workspace", // Capitalized
        }),
        "user-123"
      );
    });

    it("should trim whitespace from provided display name", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "workspace",
        displayName: "  Custom Name  ",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "Custom Name", // Trimmed
        }),
        "user-123"
      );
    });

    it("should reject display name that is only whitespace (validation error)", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "my-workspace",
        displayName: "   ", // Only whitespace
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", request)
      ).rejects.toThrow(WorkspaceChannelServiceError);

      // Should not reach repository because validation fails
      expect(mockWorkspaceRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("Workspace Data Preparation", () => {
    it("should always include settings as empty object", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "test-workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: {}, // Always present
        }),
        "user-123"
      );
    });

    it("should include ownerId in workspace data", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "test-workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-456", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "user-456",
        }),
        "user-456"
      );
    });

    it("should handle description with only whitespace", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "test-workspace",
        description: "   \n\t   ", // Various whitespace
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null, // Whitespace-only description becomes null
        }),
        "user-123"
      );
    });

    it("should preserve description with actual content", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "test-workspace",
        description: "  A real description  ",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockResolvedValue(mockWorkspace);

      // Act
      await workspaceService.createWorkspace("user-123", request);

      // Assert
      expect(mockWorkspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "A real description", // Trimmed but preserved
        }),
        "user-123"
      );
    });
  });

  describe("Error Handling", () => {
    it("should wrap generic errors in WorkspaceChannelServiceError", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "test-workspace",
      };
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockRejectedValue(
        new Error("Unexpected database error")
      );

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", request)
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should not wrap WorkspaceChannelServiceError in another error", async () => {
      // Arrange
      const request: CreateWorkspaceRequest = {
        name: "test-workspace",
      };
      const originalError = WorkspaceChannelServiceError.conflict(
        "Name already exists"
      );
      mockUserServiceClient.checkUserExistsById.mockResolvedValue(mockUserInfo);
      mockWorkspaceRepository.create.mockRejectedValue(originalError);

      // Act & Assert
      await expect(
        workspaceService.createWorkspace("user-123", request)
      ).rejects.toBe(originalError); // Same error instance
    });
  });
});
