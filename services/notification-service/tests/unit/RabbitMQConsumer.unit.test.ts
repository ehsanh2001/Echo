import "reflect-metadata";
import { RabbitMQConsumer } from "../../src/workers/RabbitMQConsumer";
import { IInviteEventHandler } from "../../src/interfaces/handlers/IInviteEventHandler";
import {
  NotificationEvent,
  WorkspaceInviteCreatedEvent,
  WorkspaceRole,
} from "../../src/types/events";
import amqp from "amqplib";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

// Mock amqplib
jest.mock("amqplib");

// Mock config
jest.mock("../../src/config/env", () => ({
  config: {
    rabbitmq: {
      url: "amqp://test:password@localhost:5672",
      exchange: "echo.events",
      queue: "notification_service_queue",
    },
  },
}));

// Mock logger
jest.mock("../../src/config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("RabbitMQConsumer", () => {
  let rabbitMQConsumer: RabbitMQConsumer;
  let mockInviteEventHandler: jest.Mocked<IInviteEventHandler>;
  let mockChannel: any;
  let mockConnection: any;

  const createMockMessage = (eventType: string): amqp.ConsumeMessage => {
    const event: NotificationEvent = {
      eventId: "event-123",
      eventType: eventType as any,
      aggregateType: "workspace",
      aggregateId: "ws-123",
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        inviteId: "invite-123",
        workspaceId: "ws-123",
        workspaceName: "test-workspace",
        workspaceDisplayName: "Test Workspace",
        email: "test@example.com",
        role: WorkspaceRole.MEMBER,
        inviterUserId: "user-123",
        inviteToken: "token123",
        inviteUrl: "http://localhost/invite/token123",
        expiresAt: null,
      },
      metadata: {
        source: "workspace-channel-service",
      },
    };

    return {
      content: Buffer.from(JSON.stringify(event)),
      fields: {
        routingKey: eventType,
      } as any,
      properties: {} as any,
    };
  };

  beforeEach(() => {
    // Create mock channel
    mockChannel = {
      prefetch: jest.fn(),
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    };

    // Create mock connection
    mockConnection = {
      createChannel: jest
        .fn<() => Promise<any>>()
        .mockResolvedValue(mockChannel),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    // Mock amqp.connect
    (amqp.connect as jest.Mock<() => Promise<any>>).mockResolvedValue(
      mockConnection,
    );

    // Create mock invite event handler
    mockInviteEventHandler = {
      handleWorkspaceInviteCreated: jest.fn(),
    } as any;

    // Create mock password reset event handler
    const mockPasswordResetEventHandler = {
      handlePasswordResetRequested: jest.fn(),
    } as any;

    // Create consumer instance
    rabbitMQConsumer = new RabbitMQConsumer(
      mockInviteEventHandler,
      mockPasswordResetEventHandler,
    );
  });

  describe("routeEvent()", () => {
    it("should route workspace.invite.created to correct handler", async () => {
      // Arrange
      mockInviteEventHandler.handleWorkspaceInviteCreated.mockResolvedValue(
        undefined,
      );

      const event: WorkspaceInviteCreatedEvent = {
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
          email: "test@example.com",
          role: WorkspaceRole.MEMBER,
          inviterUserId: "user-123",
          inviteToken: "token123",
          inviteUrl: "http://localhost/invite/token123",
          expiresAt: null,
        },
        metadata: {
          source: "workspace-channel-service",
        },
      };

      // Act
      await (rabbitMQConsumer as any).routeEvent(event);

      // Assert
      expect(
        mockInviteEventHandler.handleWorkspaceInviteCreated,
      ).toHaveBeenCalledWith(event);
    });

    it("should not throw error for unknown event types", async () => {
      // Arrange
      const unknownEvent = {
        eventId: "event-123",
        eventType: "unknown.event.type",
        aggregateType: "workspace",
        aggregateId: "ws-123",
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: {},
        metadata: {
          source: "workspace-channel-service",
        },
      } as any;

      // Act & Assert - should not throw
      await expect(
        (rabbitMQConsumer as any).routeEvent(unknownEvent),
      ).resolves.not.toThrow();
    });
  });

  describe("handleMessage()", () => {
    beforeEach(async () => {
      // Initialize consumer to set up channel
      await rabbitMQConsumer.initialize();
    });

    it("should acknowledge message after successful processing", async () => {
      // Arrange
      mockInviteEventHandler.handleWorkspaceInviteCreated.mockResolvedValue(
        undefined,
      );
      const message = createMockMessage("workspace.invite.created");

      // Act
      await (rabbitMQConsumer as any).handleMessage(message);

      // Assert
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it("should nack message when handler throws error", async () => {
      // Arrange
      mockInviteEventHandler.handleWorkspaceInviteCreated.mockRejectedValue(
        new Error("Handler error"),
      );
      const message = createMockMessage("workspace.invite.created");

      // Act
      await (rabbitMQConsumer as any).handleMessage(message);

      // Assert
      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it("should handle invalid JSON gracefully", async () => {
      // Arrange
      const invalidMessage = {
        content: Buffer.from("invalid json {"),
        fields: {
          routingKey: "workspace.invite.created",
        } as any,
        properties: {} as any,
      };

      // Act
      await (rabbitMQConsumer as any).handleMessage(invalidMessage);

      // Assert
      expect(mockChannel.nack).toHaveBeenCalledWith(
        invalidMessage,
        false,
        false,
      );
      expect(
        mockInviteEventHandler.handleWorkspaceInviteCreated,
      ).not.toHaveBeenCalled();
    });

    it("should handle null message", async () => {
      // Act & Assert - should not throw
      await expect(
        (rabbitMQConsumer as any).handleMessage(null),
      ).resolves.not.toThrow();

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });
  });

  describe("maskRabbitMQUrl()", () => {
    it("should mask password in URL", () => {
      // Act
      const masked = (rabbitMQConsumer as any).maskRabbitMQUrl(
        "amqp://user:secret123@localhost:5672",
      );

      // Assert
      expect(masked).toBe("amqp://user:****@localhost:5672");
      expect(masked).not.toContain("secret123");
    });

    it("should handle URL without password", () => {
      // Act
      const masked = (rabbitMQConsumer as any).maskRabbitMQUrl(
        "amqp://localhost:5672",
      );

      // Assert
      expect(masked).toBe("amqp://localhost:5672");
    });

    it("should handle invalid URL", () => {
      // Act
      const masked = (rabbitMQConsumer as any).maskRabbitMQUrl("invalid-url");

      // Assert
      expect(masked).toBe("amqp://****");
    });
  });
});
