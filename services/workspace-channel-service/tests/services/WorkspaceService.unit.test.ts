import "reflect-metadata";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WorkspaceService } from "../../src/services/WorkspaceService";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { IChannelRepository } from "../../src/interfaces/repositories/IChannelRepository";
import { IInviteRepository } from "../../src/interfaces/repositories/IInviteRepository";
import { UserServiceClient } from "../../src/services/userServiceClient";
import { CreateWorkspaceRequest, UserInfo } from "../../src/types";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { Workspace } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

describe("WorkspaceService (Unit Tests)", () => {
  let workspaceService: WorkspaceService;
  let mockWorkspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let mockChannelRepository: jest.Mocked<IChannelRepository>;
  let mockInviteRepository: jest.Mocked<IInviteRepository>;
  let mockUserServiceClient: jest.Mocked<UserServiceClient>;
  let mockPrisma: jest.Mocked<PrismaClient>;

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
      addOrReactivateMember: jest.fn(),
      getMembership: jest.fn(),
      countActiveMembers: jest.fn(),
      findWorkspacesByUserId: jest.fn(),
    } as any;

    mockChannelRepository = {
      create: jest.fn(),
      createInTransaction: jest.fn(),
      findById: jest.fn(),
      addMember: jest.fn(),
      findPublicChannelsByWorkspace: jest.fn(),
      addOrReactivateMember: jest.fn(),
      getChannelMembershipsByUserId: jest.fn(),
    } as any;

    mockInviteRepository = {
      findByToken: jest.fn(),
      markAsAccepted: jest.fn(),
    } as any;

    mockUserServiceClient = {
      checkUserExistsById: jest.fn(),
    } as any;

    mockPrisma = {
      $transaction: jest.fn((callback: any) => callback(mockPrisma)),
    } as any;

    // Create service with mocked dependencies
    workspaceService = new WorkspaceService(
      mockWorkspaceRepository,
      mockChannelRepository,
      mockInviteRepository,
      mockUserServiceClient,
      mockPrisma
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

  describe("getWorkspaceDetails", () => {
    const mockWorkspaceWithSettings = {
      ...mockWorkspace,
      settings: { theme: "dark", notifications: true },
    };

    const mockMembership = {
      id: "membership-123",
      workspaceId: "workspace-123",
      userId: "user-123",
      role: "member" as const,
      invitedBy: "owner-user-id",
      joinedAt: new Date("2023-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2023-01-02T00:00:00.000Z"),
      leftAt: null,
      isActive: true,
      preferences: {},
    };

    it("should return workspace details with user role and member count for active member", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(
        mockWorkspaceWithSettings
      );
      mockWorkspaceRepository.getMembership.mockResolvedValue(mockMembership);
      mockWorkspaceRepository.countActiveMembers.mockResolvedValue(5);

      // Act
      const result = await workspaceService.getWorkspaceDetails(
        "user-123",
        "workspace-123"
      );

      // Assert
      expect(mockWorkspaceRepository.findById).toHaveBeenCalledWith(
        "workspace-123"
      );
      expect(mockWorkspaceRepository.getMembership).toHaveBeenCalledWith(
        "user-123",
        "workspace-123"
      );
      expect(mockWorkspaceRepository.countActiveMembers).toHaveBeenCalledWith(
        "workspace-123"
      );
      expect(result).toEqual({
        id: mockWorkspaceWithSettings.id,
        name: mockWorkspaceWithSettings.name,
        displayName: mockWorkspaceWithSettings.displayName,
        description: mockWorkspaceWithSettings.description,
        ownerId: mockWorkspaceWithSettings.ownerId,
        isArchived: mockWorkspaceWithSettings.isArchived,
        maxMembers: mockWorkspaceWithSettings.maxMembers,
        isPublic: mockWorkspaceWithSettings.isPublic,
        vanityUrl: mockWorkspaceWithSettings.vanityUrl,
        settings: mockWorkspaceWithSettings.settings,
        createdAt: mockWorkspaceWithSettings.createdAt,
        updatedAt: mockWorkspaceWithSettings.updatedAt,
        userRole: "member",
        memberCount: 5,
      });
    });

    it("should return workspace details for owner with correct role", async () => {
      // Arrange
      const ownerMembership = {
        ...mockMembership,
        role: "owner" as const,
      };
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getMembership.mockResolvedValue(ownerMembership);
      mockWorkspaceRepository.countActiveMembers.mockResolvedValue(10);

      // Act
      const result = await workspaceService.getWorkspaceDetails(
        "user-123",
        "workspace-123"
      );

      // Assert
      expect(result.userRole).toBe("owner");
      expect(result.memberCount).toBe(10);
    });

    it("should throw 404 error when workspace does not exist", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        workspaceService.getWorkspaceDetails(
          "user-123",
          "nonexistent-workspace"
        )
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.getWorkspaceDetails(
          "user-123",
          "nonexistent-workspace"
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining("Workspace"),
      });

      // Verify it didn't try to check membership or count members
      expect(mockWorkspaceRepository.getMembership).not.toHaveBeenCalled();
      expect(mockWorkspaceRepository.countActiveMembers).not.toHaveBeenCalled();
    });

    it("should throw 403 error when user is not a member of the workspace", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getMembership.mockResolvedValue(null); // Not a member

      // Act & Assert
      await expect(
        workspaceService.getWorkspaceDetails("non-member-user", "workspace-123")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.getWorkspaceDetails("non-member-user", "workspace-123")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "You are not a member of this workspace",
      });

      // Verify it didn't try to count members
      expect(mockWorkspaceRepository.countActiveMembers).not.toHaveBeenCalled();
    });

    it("should throw 403 error when user membership is inactive", async () => {
      // Arrange
      const inactiveMembership = {
        ...mockMembership,
        isActive: false,
      };
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getMembership.mockResolvedValue(
        inactiveMembership
      );

      // Act & Assert
      await expect(
        workspaceService.getWorkspaceDetails("user-123", "workspace-123")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.getWorkspaceDetails("user-123", "workspace-123")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Your membership in this workspace is inactive",
      });

      // Verify it didn't try to count members
      expect(mockWorkspaceRepository.countActiveMembers).not.toHaveBeenCalled();
    });

    it("should include settings in the response", async () => {
      // Arrange
      const customSettings = {
        allowGuestInvites: false,
        messageRetentionDays: 90,
        theme: "light",
      };
      const workspaceWithCustomSettings = {
        ...mockWorkspace,
        settings: customSettings,
      };
      mockWorkspaceRepository.findById.mockResolvedValue(
        workspaceWithCustomSettings
      );
      mockWorkspaceRepository.getMembership.mockResolvedValue(mockMembership);
      mockWorkspaceRepository.countActiveMembers.mockResolvedValue(8);

      // Act
      const result = await workspaceService.getWorkspaceDetails(
        "user-123",
        "workspace-123"
      );

      // Assert
      expect(result.settings).toEqual(customSettings);
    });

    it("should handle workspace with zero member count (edge case)", async () => {
      // Arrange - This shouldn't happen in reality but testing edge case
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getMembership.mockResolvedValue(mockMembership);
      mockWorkspaceRepository.countActiveMembers.mockResolvedValue(0);

      // Act
      const result = await workspaceService.getWorkspaceDetails(
        "user-123",
        "workspace-123"
      );

      // Assert
      expect(result.memberCount).toBe(0);
    });

    it("should handle archived workspace (still accessible to members)", async () => {
      // Arrange
      const archivedWorkspace = {
        ...mockWorkspace,
        isArchived: true,
      };
      mockWorkspaceRepository.findById.mockResolvedValue(archivedWorkspace);
      mockWorkspaceRepository.getMembership.mockResolvedValue(mockMembership);
      mockWorkspaceRepository.countActiveMembers.mockResolvedValue(2);

      // Act
      const result = await workspaceService.getWorkspaceDetails(
        "user-123",
        "workspace-123"
      );

      // Assert
      expect(result.isArchived).toBe(true);
      expect(result.userRole).toBe("member");
      expect(result.memberCount).toBe(2);
    });

    it("should call repository methods in correct order", async () => {
      // Arrange
      const callOrder: string[] = [];
      mockWorkspaceRepository.findById.mockImplementation(async () => {
        callOrder.push("findById");
        return mockWorkspace;
      });
      mockWorkspaceRepository.getMembership.mockImplementation(async () => {
        callOrder.push("getMembership");
        return mockMembership;
      });
      mockWorkspaceRepository.countActiveMembers.mockImplementation(
        async () => {
          callOrder.push("countActiveMembers");
          return 5;
        }
      );

      // Act
      await workspaceService.getWorkspaceDetails("user-123", "workspace-123");

      // Assert - Verify operations happen in the correct sequence
      expect(callOrder).toEqual([
        "findById",
        "getMembership",
        "countActiveMembers",
      ]);
    });

    it("should handle workspace with large member count", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockWorkspaceRepository.getMembership.mockResolvedValue(mockMembership);
      mockWorkspaceRepository.countActiveMembers.mockResolvedValue(10000);

      // Act
      const result = await workspaceService.getWorkspaceDetails(
        "user-123",
        "workspace-123"
      );

      // Assert
      expect(result.memberCount).toBe(10000);
    });
  });

  describe("acceptInvite", () => {
    const mockInvite: any = {
      id: "invite-123",
      workspaceId: "workspace-123",
      inviterId: "inviter-456",
      type: "workspace",
      email: "test@example.com",
      inviteToken: "valid-token-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      acceptedAt: null,
      acceptedBy: null,
      role: "member",
      channelId: null,
      createdAt: new Date(),
      metadata: {},
    };

    const mockChannel1: any = {
      id: "channel-1",
      name: "general",
      displayName: "General",
      workspaceId: "workspace-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      description: "General channel",
      isPrivate: false,
      isArchived: false,
      createdBy: "user-123",
      type: "public",
      settings: {},
      memberCount: 10,
      lastActivity: null,
      isReadOnly: false,
    };

    const mockChannel2: any = {
      id: "channel-2",
      name: "random",
      displayName: "Random",
      workspaceId: "workspace-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      description: "Random channel",
      isPrivate: false,
      isArchived: false,
      createdBy: "user-123",
      type: "public",
      settings: {},
      memberCount: 5,
      lastActivity: null,
      isReadOnly: false,
    };

    const mockMembershipResult: any = {
      id: "membership-123",
      workspaceId: "workspace-123",
      userId: "user-789",
      role: "member",
      invitedBy: "inviter-456",
      joinedAt: new Date(),
      lastSeenAt: null,
      leftAt: null,
      isActive: true,
      preferences: {},
    };

    const mockChannelMembershipResult: any = {
      id: "channel-membership-123",
      userId: "user-789",
      role: "member",
      joinedAt: new Date(),
      isActive: true,
      channelId: "channel-1",
      joinedBy: "inviter-456",
      isMuted: false,
    };

    const mockUpdatedInvite: any = {
      ...mockInvite,
      acceptedBy: "user-789",
      acceptedAt: new Date(),
    };

    it("should accept invite and add user to workspace and all public channels", async () => {
      // Arrange
      mockInviteRepository.findByToken.mockResolvedValue(mockInvite);
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockChannelRepository.findPublicChannelsByWorkspace.mockResolvedValue([
        mockChannel1,
        mockChannel2,
      ]);
      mockWorkspaceRepository.addOrReactivateMember.mockResolvedValue(
        mockMembershipResult
      );
      mockChannelRepository.addOrReactivateMember.mockResolvedValue(
        mockChannelMembershipResult
      );
      mockInviteRepository.markAsAccepted.mockResolvedValue(mockUpdatedInvite);

      // Act
      const result = await workspaceService.acceptInvite(
        "valid-token-123",
        "user-789"
      );

      // Assert - Initial lookups happen outside transaction
      expect(mockInviteRepository.findByToken).toHaveBeenCalledWith(
        "valid-token-123"
      );
      expect(mockWorkspaceRepository.findById).toHaveBeenCalledWith(
        "workspace-123"
      );

      // Transaction operations
      expect(
        mockWorkspaceRepository.addOrReactivateMember
      ).toHaveBeenCalledWith(
        "workspace-123",
        "user-789",
        "member",
        "inviter-456",
        mockPrisma
      );
      expect(mockInviteRepository.markAsAccepted).toHaveBeenCalledWith(
        "invite-123",
        "user-789",
        expect.any(Date),
        mockPrisma
      );
      expect(
        mockChannelRepository.findPublicChannelsByWorkspace
      ).toHaveBeenCalledWith("workspace-123", mockPrisma);
      expect(mockChannelRepository.addOrReactivateMember).toHaveBeenCalledTimes(
        2
      );
      expect(mockChannelRepository.addOrReactivateMember).toHaveBeenCalledWith(
        "channel-1",
        "user-789",
        "inviter-456",
        "member",
        mockPrisma
      );
      expect(mockChannelRepository.addOrReactivateMember).toHaveBeenCalledWith(
        "channel-2",
        "user-789",
        "inviter-456",
        "member",
        mockPrisma
      );

      // Verify response structure
      expect(result.workspace.id).toBe(mockWorkspace.id);
      expect(result.workspace.name).toBe(mockWorkspace.name);
      expect(result.workspace.displayName).toBe(mockWorkspace.displayName);
      expect(result.channels).toHaveLength(2);
      expect(result.channels[0]!.id).toBe(mockChannel1.id);
      expect(result.channels[1]!.id).toBe(mockChannel2.id);
    });

    it("should throw 404 error if invite token not found", async () => {
      // Arrange
      mockInviteRepository.findByToken.mockResolvedValue(null);

      // Act & Assert
      await expect(
        workspaceService.acceptInvite("invalid-token", "user-789")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.acceptInvite("invalid-token", "user-789")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });
    });

    it("should throw 400 error if invite is not a workspace invite", async () => {
      // Arrange
      const channelInvite = {
        ...mockInvite,
        type: "channel",
      };
      mockInviteRepository.findByToken.mockResolvedValue(channelInvite);

      // Act & Assert
      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "BAD_REQUEST",
      });
    });

    it("should throw 410 error if invite is expired", async () => {
      // Arrange
      const expiredInvite = {
        ...mockInvite,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };
      mockInviteRepository.findByToken.mockResolvedValue(expiredInvite);

      // Act & Assert
      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toMatchObject({
        statusCode: 410,
        code: "EXPIRED",
      });
    });

    it("should throw 404 error if workspace not found", async () => {
      // Arrange
      mockInviteRepository.findByToken.mockResolvedValue(mockInvite);
      mockWorkspaceRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });
    });

    it("should throw 403 error if workspace is archived", async () => {
      // Arrange
      const archivedWorkspace = {
        ...mockWorkspace,
        isArchived: true,
      };
      mockInviteRepository.findByToken.mockResolvedValue(mockInvite);
      mockWorkspaceRepository.findById.mockResolvedValue(archivedWorkspace);

      // Act & Assert
      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceService.acceptInvite("valid-token-123", "user-789")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });

    it("should handle workspace with no public channels", async () => {
      // Arrange
      mockInviteRepository.findByToken.mockResolvedValue(mockInvite);
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockChannelRepository.findPublicChannelsByWorkspace.mockResolvedValue([]);
      mockWorkspaceRepository.addOrReactivateMember.mockResolvedValue(
        mockMembershipResult
      );
      mockInviteRepository.markAsAccepted.mockResolvedValue(mockUpdatedInvite);

      // Act
      const result = await workspaceService.acceptInvite(
        "valid-token-123",
        "user-789"
      );

      // Assert
      expect(
        mockChannelRepository.addOrReactivateMember
      ).not.toHaveBeenCalled();
      expect(result.workspace.id).toBe(mockWorkspace.id);
      expect(result.workspace.name).toBe(mockWorkspace.name);
      expect(result.channels).toEqual([]);
    });

    it("should use userId as fallback when inviterId is null", async () => {
      // Arrange
      const inviteWithoutInviter = {
        ...mockInvite,
        inviterId: null,
      };
      mockInviteRepository.findByToken.mockResolvedValue(inviteWithoutInviter);
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockChannelRepository.findPublicChannelsByWorkspace.mockResolvedValue([
        mockChannel1,
      ]);
      mockWorkspaceRepository.addOrReactivateMember.mockResolvedValue(
        mockMembershipResult
      );
      mockChannelRepository.addOrReactivateMember.mockResolvedValue(
        mockChannelMembershipResult
      );
      mockInviteRepository.markAsAccepted.mockResolvedValue(mockUpdatedInvite);

      // Act
      await workspaceService.acceptInvite("valid-token-123", "user-789");

      // Assert - Should use userId when inviterId is null
      expect(
        mockWorkspaceRepository.addOrReactivateMember
      ).toHaveBeenCalledWith(
        "workspace-123",
        "user-789",
        "member",
        "user-789", // userId used as fallback
        mockPrisma
      );
      expect(mockChannelRepository.addOrReactivateMember).toHaveBeenCalledWith(
        "channel-1",
        "user-789",
        "user-789", // userId used as fallback
        "member",
        mockPrisma
      );
    });

    it("should execute all operations within a transaction", async () => {
      // Arrange
      mockInviteRepository.findByToken.mockResolvedValue(mockInvite);
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockChannelRepository.findPublicChannelsByWorkspace.mockResolvedValue([
        mockChannel1,
      ]);
      mockWorkspaceRepository.addOrReactivateMember.mockResolvedValue(
        mockMembershipResult
      );
      mockChannelRepository.addOrReactivateMember.mockResolvedValue(
        mockChannelMembershipResult
      );
      mockInviteRepository.markAsAccepted.mockResolvedValue(mockUpdatedInvite);

      // Act
      await workspaceService.acceptInvite("valid-token-123", "user-789");

      // Assert - Verify transaction was used
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe("getUserMemberships", () => {
    const userId = "user-123";

    const mockWorkspacesData = [
      {
        workspace: {
          id: "workspace-1",
          name: "alpha-workspace",
          displayName: "Alpha Workspace",
          description: "First workspace",
          ownerId: "owner-1",
          isArchived: false,
          maxMembers: null,
          isPublic: true,
          vanityUrl: null,
          settings: {},
          createdAt: new Date("2023-01-01T00:00:00.000Z"),
          updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        },
        memberCount: 5,
        userRole: "admin",
      },
      {
        workspace: {
          id: "workspace-2",
          name: "beta-workspace",
          displayName: "Beta Workspace",
          description: "Second workspace",
          ownerId: "owner-2",
          isArchived: false,
          maxMembers: 100,
          isPublic: false,
          vanityUrl: "beta",
          settings: { theme: "dark" },
          createdAt: new Date("2023-01-02T00:00:00.000Z"),
          updatedAt: new Date("2023-01-02T00:00:00.000Z"),
        },
        memberCount: 3,
        userRole: "member",
      },
    ];

    const mockChannelMemberships = [
      {
        channel: {
          id: "channel-1",
          workspaceId: "workspace-1",
          name: "general",
          displayName: "General",
          description: "General discussion",
          type: "public" as any,
          isArchived: false,
          isReadOnly: false,
          createdBy: "user-456",
          memberCount: 10,
          lastActivity: new Date("2023-01-01T12:00:00.000Z"),
          settings: {},
          createdAt: new Date("2023-01-01T00:00:00.000Z"),
          updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        },
        membership: {
          id: "membership-1",
          channelId: "channel-1",
          userId: "user-123",
          role: "admin" as any,
          joinedAt: new Date("2023-01-01T00:00:00.000Z"),
          isMuted: false,
          isActive: true,
          joinedBy: "user-456",
        },
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return user memberships without channels when includeChannels is false", async () => {
      // Arrange
      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue(
        mockWorkspacesData
      );

      // Act
      const result = await workspaceService.getUserMemberships(userId, false);

      // Assert
      expect(
        mockWorkspaceRepository.findWorkspacesByUserId
      ).toHaveBeenCalledWith(userId);
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).not.toHaveBeenCalled();

      expect(result.workspaces).toHaveLength(2);
      expect(result.workspaces[0]).toEqual({
        ...mockWorkspacesData[0]!.workspace,
        userRole: "admin",
        memberCount: 5,
      });
      expect(result.workspaces[0]?.channels).toBeUndefined();

      expect(result.workspaces[1]).toEqual({
        ...mockWorkspacesData[1]!.workspace,
        userRole: "member",
        memberCount: 3,
      });
      expect(result.workspaces[1]?.channels).toBeUndefined();
    });

    it("should return user memberships with channels when includeChannels is true", async () => {
      // Arrange
      const firstWorkspace = mockWorkspacesData[0];
      if (!firstWorkspace) throw new Error("Test data missing");

      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue([
        firstWorkspace,
      ]);
      mockChannelRepository.getChannelMembershipsByUserId.mockResolvedValue(
        mockChannelMemberships
      );

      // Act
      const result = await workspaceService.getUserMemberships(userId, true);

      // Assert
      expect(
        mockWorkspaceRepository.findWorkspacesByUserId
      ).toHaveBeenCalledWith(userId);
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).toHaveBeenCalledWith(userId, "workspace-1");

      expect(result.workspaces).toHaveLength(1);
      expect(result.workspaces[0]?.channels).toHaveLength(1);
      expect(result.workspaces[0]?.channels![0]).toEqual({
        ...mockChannelMemberships[0]!.channel,
        role: "admin",
        joinedAt: mockChannelMemberships[0]!.membership.joinedAt,
        isMuted: false,
        joinedBy: "user-456",
      });
    });

    it("should default to includeChannels=false when parameter is not provided", async () => {
      // Arrange
      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue(
        mockWorkspacesData
      );

      // Act
      const result = await workspaceService.getUserMemberships(userId);

      // Assert
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).not.toHaveBeenCalled();
      expect(result.workspaces[0]?.channels).toBeUndefined();
    });

    it("should return empty array when user has no workspace memberships", async () => {
      // Arrange
      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue([]);

      // Act
      const result = await workspaceService.getUserMemberships(userId, true);

      // Assert
      expect(result.workspaces).toHaveLength(0);
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).not.toHaveBeenCalled();
    });

    it("should handle workspaces with no channel memberships when includeChannels is true", async () => {
      // Arrange
      const firstWorkspace = mockWorkspacesData[0];
      if (!firstWorkspace) throw new Error("Test data missing");

      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue([
        firstWorkspace,
      ]);
      mockChannelRepository.getChannelMembershipsByUserId.mockResolvedValue([]);

      // Act
      const result = await workspaceService.getUserMemberships(userId, true);

      // Assert
      expect(result.workspaces).toHaveLength(1);
      expect(result.workspaces[0]?.channels).toHaveLength(0);
    });

    it("should throw WorkspaceChannelServiceError when repository throws error", async () => {
      // Arrange
      const error = new Error("Database connection failed");
      mockWorkspaceRepository.findWorkspacesByUserId.mockRejectedValue(error);

      // Act & Assert
      await expect(workspaceService.getUserMemberships(userId)).rejects.toThrow(
        WorkspaceChannelServiceError
      );
      expect(
        mockWorkspaceRepository.findWorkspacesByUserId
      ).toHaveBeenCalledWith(userId);
    });

    it("should throw WorkspaceChannelServiceError when channel repository throws error", async () => {
      // Arrange
      const firstWorkspace = mockWorkspacesData[0];
      if (!firstWorkspace) throw new Error("Test data missing");

      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue([
        firstWorkspace,
      ]);
      const error = new Error("Channel query failed");
      mockChannelRepository.getChannelMembershipsByUserId.mockRejectedValue(
        error
      );

      // Act & Assert
      await expect(
        workspaceService.getUserMemberships(userId, true)
      ).rejects.toThrow(WorkspaceChannelServiceError);
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).toHaveBeenCalledWith(userId, "workspace-1");
    });

    it("should call getChannelMembershipsByUserId for each workspace when includeChannels is true", async () => {
      // Arrange
      mockWorkspaceRepository.findWorkspacesByUserId.mockResolvedValue(
        mockWorkspacesData
      );
      mockChannelRepository.getChannelMembershipsByUserId
        .mockResolvedValueOnce([]) // workspace-1
        .mockResolvedValueOnce([]); // workspace-2

      // Act
      await workspaceService.getUserMemberships(userId, true);

      // Assert
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).toHaveBeenCalledTimes(2);
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).toHaveBeenCalledWith(userId, "workspace-1");
      expect(
        mockChannelRepository.getChannelMembershipsByUserId
      ).toHaveBeenCalledWith(userId, "workspace-2");
    });
  });
});
