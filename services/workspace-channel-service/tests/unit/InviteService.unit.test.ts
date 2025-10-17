import "reflect-metadata";
import { InviteService } from "../../src/services/InviteService";
import { IInviteRepository } from "../../src/interfaces/repositories/IInviteRepository";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { IOutboxService } from "../../src/interfaces/services/IOutboxService";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { Invite, Workspace, WorkspaceRole } from "@prisma/client";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
describe("InviteService", () => {
  let inviteService: InviteService;
  let mockInviteRepository: jest.Mocked<IInviteRepository>;
  let mockWorkspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let mockOutboxService: jest.Mocked<IOutboxService>;

  const mockWorkspace: Workspace = {
    id: "ws-123",
    name: "test-workspace",
    displayName: "Test Workspace",
    description: null,
    ownerId: "user-owner",
    isArchived: false,
    maxMembers: null,
    isPublic: true,
    vanityUrl: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInvite: Invite = {
    id: "invite-123",
    workspaceId: "ws-123",
    channelId: null,
    inviterId: "user-owner",
    email: "invitee@example.com",
    inviteToken: "abc123token",
    type: "workspace",
    role: WorkspaceRole.member,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    acceptedBy: null,
    acceptedAt: null,
    metadata: {},
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Create mock implementations
    mockInviteRepository = {
      create: jest.fn(),
      findPendingByEmailAndWorkspace: jest.fn(),
      findAllPending: jest.fn(),
      invalidateInvite: jest.fn(),
      deleteUnacceptedExpired: jest.fn(),
      findByToken: jest.fn(),
      markAsAccepted: jest.fn(),
    };

    mockWorkspaceRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      addMember: jest.fn(),
      getMembership: jest.fn(),
      countActiveMembers: jest.fn(),
      addOrReactivateMember: jest.fn(),
    };

    mockOutboxService = {
      createInviteEvent: jest.fn(),
    };

    // Create service instance with mocks
    inviteService = new InviteService(
      mockInviteRepository,
      mockWorkspaceRepository,
      mockOutboxService
    );
  });

  describe("createWorkspaceInvite", () => {
    it("should create a workspace invite successfully", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockInviteRepository.create.mockResolvedValue(mockInvite);
      mockOutboxService.createInviteEvent.mockResolvedValue({} as any);

      const inviteData = {
        email: "newuser@example.com",
        role: WorkspaceRole.member,
        expiresInDays: 7,
      };

      // Act
      const result = await inviteService.createWorkspaceInvite(
        "ws-123",
        "user-owner",
        inviteData
      );

      // Assert
      expect(result).toMatchObject({
        inviteId: mockInvite.id,
        email: mockInvite.email,
        workspaceId: mockInvite.workspaceId,
        role: mockInvite.role,
        invitedBy: mockInvite.inviterId,
      });
      expect(result.inviteUrl).toContain("/invite/");
      expect(mockWorkspaceRepository.findById).toHaveBeenCalledWith("ws-123");
      expect(mockInviteRepository.create).toHaveBeenCalled();
      expect(mockOutboxService.createInviteEvent).toHaveBeenCalled();
    });

    it("should throw error if workspace not found", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-999", "user-owner", {
          email: "test@example.com",
        })
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should throw error if workspace is archived", async () => {
      // Arrange
      const archivedWorkspace = { ...mockWorkspace, isArchived: true };
      mockWorkspaceRepository.findById.mockResolvedValue(archivedWorkspace);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "test@example.com",
        })
      ).rejects.toThrow("Cannot create invites for archived workspaces");
    });

    it("should throw validation error for invalid email", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "invalid-email",
        })
      ).rejects.toThrow("Invalid email format");
    });

    it("should throw validation error for empty email", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "   ",
        })
      ).rejects.toThrow("Email cannot be empty");
    });

    it("should throw validation error for invalid role", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "test@example.com",
          role: "superadmin" as any,
        })
      ).rejects.toThrow("Invalid role");
    });

    it("should use default role when role is not provided", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockInviteRepository.create.mockResolvedValue(mockInvite);
      mockOutboxService.createInviteEvent.mockResolvedValue({} as any);

      // Act
      await inviteService.createWorkspaceInvite("ws-123", "user-owner", {
        email: "test@example.com",
      });

      // Assert
      expect(mockInviteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: WorkspaceRole.member, // default role
        })
      );
    });

    it("should throw validation error for expiration days too low", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "test@example.com",
          expiresInDays: 0,
        })
      ).rejects.toThrow("Expiration days must be at least");
    });

    it("should throw validation error for expiration days too high", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "test@example.com",
          expiresInDays: 31,
        })
      ).rejects.toThrow("Expiration days cannot exceed");
    });

    it("should throw validation error for custom message too long", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      const longMessage = "a".repeat(501); // Exceeds 500 char limit

      // Act & Assert
      await expect(
        inviteService.createWorkspaceInvite("ws-123", "user-owner", {
          email: "test@example.com",
          customMessage: longMessage,
        })
      ).rejects.toThrow("Custom message cannot exceed");
    });

    it("should normalize email to lowercase", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockInviteRepository.create.mockResolvedValue(mockInvite);
      mockOutboxService.createInviteEvent.mockResolvedValue({} as any);

      // Act
      await inviteService.createWorkspaceInvite("ws-123", "user-owner", {
        email: "Test@EXAMPLE.COM",
      });

      // Assert
      expect(mockInviteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
        })
      );
    });

    it("should generate unique invite token", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockInviteRepository.create.mockResolvedValue(mockInvite);
      mockOutboxService.createInviteEvent.mockResolvedValue({} as any);

      // Act
      await inviteService.createWorkspaceInvite("ws-123", "user-owner", {
        email: "test@example.com",
      });

      // Assert
      expect(mockInviteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteToken: expect.any(String),
        })
      );

      const createCall = mockInviteRepository.create.mock.calls[0]?.[0];
      expect(createCall?.inviteToken.length).toBeGreaterThan(0);
    });

    it("should include custom message in metadata", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockInviteRepository.create.mockResolvedValue(mockInvite);
      mockOutboxService.createInviteEvent.mockResolvedValue({} as any);

      const customMessage = "Welcome to our team!";

      // Act
      await inviteService.createWorkspaceInvite("ws-123", "user-owner", {
        email: "test@example.com",
        customMessage,
      });

      // Assert
      expect(mockInviteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { customMessage },
        })
      );
    });

    it("should publish invite.created event", async () => {
      // Arrange
      mockWorkspaceRepository.findById.mockResolvedValue(mockWorkspace);
      mockInviteRepository.create.mockResolvedValue(mockInvite);
      mockOutboxService.createInviteEvent.mockResolvedValue({} as any);

      // Act
      await inviteService.createWorkspaceInvite("ws-123", "user-owner", {
        email: "test@example.com",
      });

      // Assert
      expect(mockOutboxService.createInviteEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteId: mockInvite.id,
          workspaceId: mockWorkspace.id,
          email: mockInvite.email,
          inviteToken: mockInvite.inviteToken,
        })
      );
    });
  });
});
