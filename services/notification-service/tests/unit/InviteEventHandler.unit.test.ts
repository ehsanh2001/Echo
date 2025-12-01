import "reflect-metadata";
import { InviteEventHandler } from "../../src/handlers/InviteEventHandler";
import { IEmailService } from "../../src/interfaces/services/IEmailService";
import { ITemplateService } from "../../src/interfaces/services/ITemplateService";
import { IUserServiceClient } from "../../src/interfaces/services/IUserServiceClient";
import {
  WorkspaceInviteCreatedEvent,
  WorkspaceRole,
} from "../../src/types/events";
import { UserProfile } from "../../src/types/email";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

describe("InviteEventHandler", () => {
  let inviteEventHandler: InviteEventHandler;
  let mockEmailService: jest.Mocked<IEmailService>;
  let mockTemplateService: jest.Mocked<ITemplateService>;
  let mockUserServiceClient: jest.Mocked<IUserServiceClient>;

  const mockUserProfile: UserProfile = {
    id: "user-123",
    email: "inviter@example.com",
    username: "inviter",
    displayName: "John Doe",
    bio: null,
    avatarUrl: null,
    createdAt: new Date(),
    lastSeen: new Date(),
    roles: [WorkspaceRole.MEMBER],
  };

  const mockEvent: WorkspaceInviteCreatedEvent = {
    eventId: "event-123",
    eventType: "workspace.invite.created",
    aggregateType: "workspace",
    aggregateId: "ws-123",
    timestamp: new Date().toISOString(),
    version: "1.0",
    data: {
      inviteId: "invite-123",
      workspaceId: "ws-123",
      workspaceName: "test-workspace",
      workspaceDisplayName: "Test Workspace",
      email: "invitee@example.com",
      role: WorkspaceRole.MEMBER,
      inviterUserId: "user-123",
      inviteToken: "abc123token",
      inviteUrl: "http://localhost:3000/invite/abc123token",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      customMessage: "Welcome to our team!",
    },
    metadata: {
      source: "workspace-channel-service",
    },
  };

  beforeEach(() => {
    // Create mock implementations
    mockEmailService = {
      send: jest.fn(),
    } as any;

    mockTemplateService = {
      initialize: jest.fn(),
      render: jest.fn(),
      hasTemplate: jest.fn(),
    } as any;

    mockUserServiceClient = {
      getUserById: jest.fn(),
    } as any;

    // Create handler instance with mocks
    inviteEventHandler = new InviteEventHandler(
      mockEmailService,
      mockTemplateService,
      mockUserServiceClient
    );
  });

  describe("handleWorkspaceInviteCreated", () => {
    it("should process workspace invite successfully", async () => {
      // Arrange
      mockUserServiceClient.getUserById.mockResolvedValue(mockUserProfile);
      mockTemplateService.render.mockResolvedValue(
        "<html>Email content</html>"
      );
      mockEmailService.send.mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      // Act
      await inviteEventHandler.handleWorkspaceInviteCreated(mockEvent);

      // Assert
      expect(mockUserServiceClient.getUserById).toHaveBeenCalledWith(
        "user-123"
      );
      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "workspace-invite",
        expect.objectContaining({
          email: "invitee@example.com",
          inviterName: "John Doe",
          workspaceName: "test-workspace",
          workspaceDisplayName: "Test Workspace",
          inviteUrl: mockEvent.data.inviteUrl,
          role: WorkspaceRole.MEMBER,
          expiresAt: mockEvent.data.expiresAt,
          customMessage: "Welcome to our team!",
        })
      );
      expect(mockEmailService.send).toHaveBeenCalledWith({
        to: "invitee@example.com",
        subject: "John Doe invited you to Test Workspace",
        html: "<html>Email content</html>",
      });
    });

    it("should use fallback inviter name when user-service returns null", async () => {
      // Arrange
      mockUserServiceClient.getUserById.mockResolvedValue(null);
      mockTemplateService.render.mockResolvedValue(
        "<html>Email content</html>"
      );
      mockEmailService.send.mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      // Act
      await inviteEventHandler.handleWorkspaceInviteCreated(mockEvent);

      // Assert
      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "workspace-invite",
        expect.objectContaining({
          inviterName: "A team member",
        })
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "A team member invited you to Test Workspace",
        })
      );
    });

    it("should use workspaceName as fallback when workspaceDisplayName is null", async () => {
      // Arrange
      const eventWithNullDisplayName = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          workspaceDisplayName: null,
        },
      };

      mockUserServiceClient.getUserById.mockResolvedValue(mockUserProfile);
      mockTemplateService.render.mockResolvedValue(
        "<html>Email content</html>"
      );
      mockEmailService.send.mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      // Act
      await inviteEventHandler.handleWorkspaceInviteCreated(
        eventWithNullDisplayName
      );

      // Assert
      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "workspace-invite",
        expect.objectContaining({
          workspaceDisplayName: "test-workspace",
        })
      );
    });

    it("should re-throw error when template rendering fails", async () => {
      // Arrange
      mockUserServiceClient.getUserById.mockResolvedValue(mockUserProfile);
      mockTemplateService.render.mockRejectedValue(
        new Error("Template not found")
      );

      // Act & Assert
      await expect(
        inviteEventHandler.handleWorkspaceInviteCreated(mockEvent)
      ).rejects.toThrow("Template not found");

      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it("should re-throw error when email sending fails", async () => {
      // Arrange
      mockUserServiceClient.getUserById.mockResolvedValue(mockUserProfile);
      mockTemplateService.render.mockResolvedValue(
        "<html>Email content</html>"
      );
      mockEmailService.send.mockResolvedValue({
        success: false,
        error: "SMTP connection failed",
      });

      // Act & Assert
      await expect(
        inviteEventHandler.handleWorkspaceInviteCreated(mockEvent)
      ).rejects.toThrow("Email send failed: SMTP connection failed");
    });

    it("should re-throw error when user-service fails", async () => {
      // Arrange
      mockUserServiceClient.getUserById.mockRejectedValue(
        new Error("User service unavailable")
      );

      // Act & Assert
      await expect(
        inviteEventHandler.handleWorkspaceInviteCreated(mockEvent)
      ).rejects.toThrow("User service unavailable");

      expect(mockTemplateService.render).not.toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it("should handle events without custom message", async () => {
      // Arrange
      const eventWithoutMessage = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          customMessage: undefined,
        },
      };

      mockUserServiceClient.getUserById.mockResolvedValue(mockUserProfile);
      mockTemplateService.render.mockResolvedValue(
        "<html>Email content</html>"
      );
      mockEmailService.send.mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      // Act
      await inviteEventHandler.handleWorkspaceInviteCreated(
        eventWithoutMessage
      );

      // Assert
      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "workspace-invite",
        expect.objectContaining({
          customMessage: undefined,
        })
      );
    });

    it("should handle events without expiration", async () => {
      // Arrange
      const eventWithoutExpiry = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          expiresAt: null,
        },
      };

      mockUserServiceClient.getUserById.mockResolvedValue(mockUserProfile);
      mockTemplateService.render.mockResolvedValue(
        "<html>Email content</html>"
      );
      mockEmailService.send.mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      // Act
      await inviteEventHandler.handleWorkspaceInviteCreated(eventWithoutExpiry);

      // Assert
      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "workspace-invite",
        expect.objectContaining({
          expiresAt: null,
        })
      );
    });
  });
});
