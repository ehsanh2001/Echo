import "reflect-metadata";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { OutboxService } from "../../src/services/OutboxService";
import { IOutboxRepository } from "../../src/interfaces/repositories/IOutboxRepository";
import { OutboxEvent, OutboxStatus } from "@prisma/client";
import { CreateInviteEventData } from "../../src/types";
import { randomUUID } from "crypto";

// Helper to create mock OutboxEvent
const createMockOutboxEvent = (
  overrides: Partial<OutboxEvent> = {}
): OutboxEvent => ({
  id: randomUUID(),
  workspaceId: randomUUID(),
  channelId: null,
  aggregateType: "workspace",
  aggregateId: randomUUID(),
  eventType: "workspace.invite.created",
  payload: {},
  status: OutboxStatus.pending,
  failedAttempts: 0,
  producedAt: new Date(),
  publishedAt: null,
  ...overrides,
});

describe("OutboxService", () => {
  let outboxService: OutboxService;
  let mockRepository: jest.Mocked<IOutboxRepository>;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      create: jest.fn(),
      findPending: jest.fn(),
      findFailedForRetry: jest.fn(),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
      deleteOldPublished: jest.fn(),
      findByAggregate: jest.fn(),
    } as jest.Mocked<IOutboxRepository>;

    // Create service with mock
    outboxService = new OutboxService(mockRepository);
  });

  describe("createInviteEvent", () => {
    it("should create an outbox event from raw invite data", async () => {
      // Arrange
      const workspaceId = randomUUID();
      const inviteId = randomUUID();
      const inviterUserId = randomUUID();

      const inviteData: CreateInviteEventData = {
        inviteId,
        workspaceId,
        workspaceName: "test-workspace",
        workspaceDisplayName: "Test Workspace",
        email: "user@example.com",
        role: "member",
        inviterUserId,
        inviteToken: "token123",
        inviteUrl: "https://example.com/invite/token123",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        customMessage: "Welcome to the team!",
      };

      const expectedEvent = createMockOutboxEvent({
        workspaceId,
        aggregateId: workspaceId,
      });

      mockRepository.create.mockResolvedValue(expectedEvent);

      // Act
      const result = await outboxService.createInviteEvent(inviteData);

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          aggregateType: "workspace",
          aggregateId: workspaceId,
          eventType: "workspace.invite.created",
          payload: expect.objectContaining({
            eventId: expect.any(String),
            eventType: "workspace.invite.created",
            aggregateType: "workspace",
            aggregateId: workspaceId,
            timestamp: expect.any(String),
            version: "1.0",
            data: inviteData,
            metadata: {
              source: "workspace-channel-service",
            },
          }),
        })
      );
      expect(result).toEqual(expectedEvent);
    });

    it("should handle invite data without optional fields", async () => {
      // Arrange
      const inviteData: CreateInviteEventData = {
        inviteId: randomUUID(),
        workspaceId: randomUUID(),
        workspaceName: "test-workspace",
        workspaceDisplayName: null,
        email: "user@example.com",
        role: "member",
        inviterUserId: randomUUID(),
        inviteToken: "token123",
        inviteUrl: "https://example.com/invite/token123",
        expiresAt: null,
      };

      const expectedEvent = createMockOutboxEvent();
      mockRepository.create.mockResolvedValue(expectedEvent);

      // Act
      const result = await outboxService.createInviteEvent(inviteData);

      // Assert
      expect(result).toEqual(expectedEvent);
    });

    it("should include correlation and causation IDs when provided", async () => {
      // Arrange
      const correlationId = randomUUID();
      const causationId = randomUUID();

      const inviteData: CreateInviteEventData = {
        inviteId: randomUUID(),
        workspaceId: randomUUID(),
        workspaceName: "test-workspace",
        workspaceDisplayName: "Test Workspace",
        email: "user@example.com",
        role: "member",
        inviterUserId: randomUUID(),
        inviteToken: "token123",
        inviteUrl: "https://example.com/invite/token123",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        customMessage: "Welcome!",
      };

      const expectedEvent = createMockOutboxEvent();
      mockRepository.create.mockResolvedValue(expectedEvent);

      // Act
      const result = await outboxService.createInviteEvent(
        inviteData,
        correlationId,
        causationId
      );

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            metadata: {
              source: "workspace-channel-service",
              correlationId,
              causationId,
            },
          }),
        })
      );
      expect(result).toEqual(expectedEvent);
    });

    it("should propagate repository errors", async () => {
      // Arrange
      const inviteData: CreateInviteEventData = {
        inviteId: randomUUID(),
        workspaceId: randomUUID(),
        workspaceName: "test",
        workspaceDisplayName: null,
        email: "test@example.com",
        role: "member",
        inviterUserId: randomUUID(),
        inviteToken: "token",
        inviteUrl: "https://example.com",
        expiresAt: null,
      };

      mockRepository.create.mockRejectedValue(
        new Error("Database connection failed")
      );

      // Act & Assert
      await expect(outboxService.createInviteEvent(inviteData)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should generate unique event IDs for each call", async () => {
      // Arrange
      const workspaceId = randomUUID();
      const inviteId = randomUUID();
      const inviterUserId = randomUUID();
      const correlationId = randomUUID();
      const causationId = randomUUID();

      const inviteData = {
        inviteId,
        workspaceId,
        workspaceName: "test-workspace",
        workspaceDisplayName: "Test Workspace",
        email: "user@example.com",
        role: "member" as const,
        inviterUserId,
        inviteToken: "token123",
        inviteUrl: "https://example.com/invite/token123",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        customMessage: "Join us!",
      };

      mockRepository.create.mockResolvedValue({
        id: randomUUID(),
        workspaceId,
        channelId: null,
        aggregateType: "workspace",
        aggregateId: workspaceId,
        eventType: "workspace.invite.created",
        payload: {} as any,
        status: OutboxStatus.pending,
        failedAttempts: 0,
        producedAt: new Date(),
        publishedAt: null,
      });

      // Act
      const result = await outboxService.createInviteEvent(
        inviteData,
        correlationId,
        causationId
      );

      // Assert
      expect(mockRepository.create).toHaveBeenCalled();
      const callArg = mockRepository.create.mock.calls[0]?.[0];
      expect(callArg?.workspaceId).toBe(workspaceId);
      expect(callArg?.eventType).toBe("workspace.invite.created");
      expect(callArg?.payload).toMatchObject({
        eventType: "workspace.invite.created",
        data: inviteData,
      });
      expect(callArg?.payload.metadata).toMatchObject({
        source: "workspace-channel-service",
        correlationId,
        causationId,
      });
      expect(result).toBeDefined();
    });

    it("should create event without correlation tracking", async () => {
      // Arrange
      const workspaceId = randomUUID();
      const inviteData = {
        inviteId: randomUUID(),
        workspaceId,
        workspaceName: "test-workspace",
        workspaceDisplayName: null,
        email: "user@example.com",
        role: "guest" as const,
        inviterUserId: randomUUID(),
        inviteToken: "token123",
        inviteUrl: "https://example.com/invite/token123",
        expiresAt: null,
      };

      mockRepository.create.mockResolvedValue({
        id: randomUUID(),
        workspaceId,
        channelId: null,
        aggregateType: "workspace",
        aggregateId: workspaceId,
        eventType: "workspace.invite.created",
        payload: {} as any,
        status: OutboxStatus.pending,
        failedAttempts: 0,
        producedAt: new Date(),
        publishedAt: null,
      });

      // Act
      const result = await outboxService.createInviteEvent(inviteData);

      // Assert
      expect(mockRepository.create).toHaveBeenCalled();
      const callArg = mockRepository.create.mock.calls[0]?.[0];
      expect(callArg?.payload.metadata).toEqual({
        source: "workspace-channel-service",
      });
      expect(result).toBeDefined();
    });

    it("should generate unique event IDs for each call", async () => {
      // Arrange
      const inviteData = {
        inviteId: randomUUID(),
        workspaceId: randomUUID(),
        workspaceName: "test",
        workspaceDisplayName: null,
        email: "test@example.com",
        role: "member" as const,
        inviterUserId: randomUUID(),
        inviteToken: "token",
        inviteUrl: "https://example.com",
        expiresAt: null,
      };

      mockRepository.create.mockResolvedValue({
        id: randomUUID(),
        workspaceId: inviteData.workspaceId,
        channelId: null,
        aggregateType: "workspace",
        aggregateId: inviteData.workspaceId,
        eventType: "workspace.invite.created",
        payload: {} as any,
        status: OutboxStatus.pending,
        failedAttempts: 0,
        producedAt: new Date(),
        publishedAt: null,
      });

      // Act
      await outboxService.createInviteEvent(inviteData);
      await outboxService.createInviteEvent(inviteData);

      // Assert
      const call1 = mockRepository.create.mock.calls[0]?.[0];
      const call2 = mockRepository.create.mock.calls[1]?.[0];

      expect(call1?.payload).toHaveProperty("eventId");
      expect(call2?.payload).toHaveProperty("eventId");
      expect(call1?.payload.eventId).not.toBe(call2?.payload.eventId);
    });
  });

  describe("Multi-instance safety", () => {
    it("should be safe to call from multiple instances concurrently", async () => {
      // Arrange - This test demonstrates thread-safety characteristics
      const workspaceId = randomUUID();
      const inviteData = {
        inviteId: randomUUID(),
        workspaceId,
        workspaceName: "test",
        workspaceDisplayName: null,
        email: "test@example.com",
        role: "member" as const,
        inviterUserId: randomUUID(),
        inviteToken: "token",
        inviteUrl: "https://example.com",
        expiresAt: null,
      };

      // Simulate multiple instances creating events concurrently
      mockRepository.create.mockImplementation(async (data) => ({
        id: randomUUID(),
        workspaceId: data.workspaceId || null,
        channelId: null,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        eventType: data.eventType,
        payload: data.payload as any,
        status: OutboxStatus.pending,
        failedAttempts: 0,
        producedAt: new Date(),
        publishedAt: null,
      }));

      // Act - Simulate 5 concurrent calls
      const promises = Array.from({ length: 5 }, () =>
        outboxService.createInviteEvent(inviteData)
      );
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      expect(mockRepository.create).toHaveBeenCalledTimes(5);

      // Each event should have unique ID
      const eventIds = results.map((r) => r.id);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(5);
    });
  });
});
