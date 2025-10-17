import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { container } from "../../src/container";
import { IInviteRepository } from "../../src/interfaces/repositories/IInviteRepository";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { CreateWorkspaceInviteData } from "../../src/types";
import { TokenUtils, DateUtils } from "../../src/utils/inviteUtils";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { randomUUID } from "crypto";

const TEST_PREFIX = "invite-repo-test";

describe("InviteRepository Integration Tests", () => {
  let inviteRepository: IInviteRepository;
  let workspaceRepository: IWorkspaceRepository;

  // Test data cleanup tracking
  const createdInviteIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeEach(async () => {
    // Get repository instances from DI container
    inviteRepository =
      container.resolve<IInviteRepository>("IInviteRepository");
    workspaceRepository = container.resolve<IWorkspaceRepository>(
      "IWorkspaceRepository"
    );
  });

  afterEach(async () => {
    // Clean up created test data
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    try {
      // Delete invites first (due to foreign key constraints)
      if (createdInviteIds.length > 0) {
        await prisma.invite.deleteMany({
          where: {
            id: { in: createdInviteIds },
          },
        });
        createdInviteIds.length = 0;
      }

      // Delete workspaces and their related data in proper order
      if (createdWorkspaceIds.length > 0) {
        // Delete channel members first
        await prisma.channelMember.deleteMany({
          where: {
            channel: {
              workspaceId: { in: createdWorkspaceIds },
            },
          },
        });

        // Delete channels
        await prisma.channel.deleteMany({
          where: {
            workspaceId: { in: createdWorkspaceIds },
          },
        });

        // Delete workspace members
        await prisma.workspaceMember.deleteMany({
          where: {
            workspaceId: { in: createdWorkspaceIds },
          },
        });

        // Finally delete workspaces
        await prisma.workspace.deleteMany({
          where: {
            id: { in: createdWorkspaceIds },
          },
        });
        createdWorkspaceIds.length = 0;
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe("create", () => {
    it("should create a workspace invite successfully", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const inviteData: CreateWorkspaceInviteData = {
        workspaceId: workspace.id,
        inviterId: workspace.ownerId,
        email: "test@example.com",
        inviteToken: TokenUtils.generateSecureToken(),
        type: "workspace",
        role: "member",
        expiresAt: DateUtils.calculateExpirationDate(7),
        metadata: { source: "test" },
      };

      // Act
      const result = await inviteRepository.create(inviteData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.workspaceId).toBe(inviteData.workspaceId);
      expect(result.inviterId).toBe(inviteData.inviterId);
      expect(result.email).toBe(inviteData.email);
      expect(result.inviteToken).toBe(inviteData.inviteToken);
      expect(result.type).toBe(inviteData.type);
      expect(result.role).toBe(inviteData.role);
      expect(result.expiresAt).toEqual(inviteData.expiresAt);
      expect(result.acceptedAt).toBeNull();
      expect(result.acceptedBy).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.metadata).toEqual(inviteData.metadata);

      createdInviteIds.push(result.id);
    });

    it("should create invite with null expiration", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const inviteData: CreateWorkspaceInviteData = {
        workspaceId: workspace.id,
        inviterId: workspace.ownerId,
        email: "test@example.com",
        inviteToken: TokenUtils.generateSecureToken(),
        type: "workspace",
        role: "admin",
        expiresAt: null,
      };

      // Act
      const result = await inviteRepository.create(inviteData);

      // Assert
      expect(result.expiresAt).toBeNull();
      expect(result.role).toBe("admin");

      createdInviteIds.push(result.id);
    });

    it("should throw conflict error for duplicate invite token", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const sharedToken = TokenUtils.generateSecureToken();

      const inviteData1: CreateWorkspaceInviteData = {
        workspaceId: workspace.id,
        inviterId: workspace.ownerId,
        email: "test1@example.com",
        inviteToken: sharedToken,
        type: "workspace",
        role: "member",
      };

      const inviteData2: CreateWorkspaceInviteData = {
        workspaceId: workspace.id,
        inviterId: workspace.ownerId,
        email: "test2@example.com",
        inviteToken: sharedToken, // Same token
        type: "workspace",
        role: "member",
      };

      // Act & Assert
      const result1 = await inviteRepository.create(inviteData1);
      createdInviteIds.push(result1.id);

      await expect(inviteRepository.create(inviteData2)).rejects.toThrow(
        WorkspaceChannelServiceError
      );
    });

    it("should throw not found error for non-existent workspace", async () => {
      // Arrange
      const inviteData: CreateWorkspaceInviteData = {
        workspaceId: randomUUID(),
        inviterId: randomUUID(),
        email: "test@example.com",
        inviteToken: TokenUtils.generateSecureToken(),
        type: "workspace",
        role: "member",
      };

      // Act & Assert
      await expect(inviteRepository.create(inviteData)).rejects.toThrow(
        WorkspaceChannelServiceError
      );
    });
  });

  describe("findPendingByEmailAndWorkspace", () => {
    it("should find pending invite when it exists", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const email = "test@example.com";
      const invite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        email
      );

      // Act
      const result = await inviteRepository.findPendingByEmailAndWorkspace(
        email,
        workspace.id
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result!.id).toBe(invite.id);
      expect(result!.email).toBe(email);
      expect(result!.workspaceId).toBe(workspace.id);
    });

    it("should return null when no pending invite exists", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const email = "nonexistent@example.com";

      // Act
      const result = await inviteRepository.findPendingByEmailAndWorkspace(
        email,
        workspace.id
      );

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for accepted invite", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const email = "test@example.com";
      const invite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        email
      );

      // Accept the invite
      await inviteRepository.invalidateInvite(invite.id, randomUUID());

      // Act
      const result = await inviteRepository.findPendingByEmailAndWorkspace(
        email,
        workspace.id
      );

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for expired invite", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const email = "test@example.com";
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const invite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        email,
        pastDate
      );

      // Act
      const result = await inviteRepository.findPendingByEmailAndWorkspace(
        email,
        workspace.id
      );

      // Assert
      expect(result).toBeNull();
    });

    it("should return most recent pending invite when multiple exist", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const email = "test@example.com";

      const invite1 = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        email
      );
      // Wait a bit to ensure different creation times
      await new Promise((resolve) => setTimeout(resolve, 10));
      const invite2 = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        email
      );

      // Act
      const result = await inviteRepository.findPendingByEmailAndWorkspace(
        email,
        workspace.id
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result!.id).toBe(invite2.id); // Should return the more recent one
    });
  });

  describe("findAllPending", () => {
    it("should return all pending invites", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const invite1 = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "test1@example.com"
      );
      const invite2 = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "test2@example.com"
      );

      // Act
      const result = await inviteRepository.findAllPending();

      // Assert
      const testInvites = result.filter((invite) =>
        [invite1.id, invite2.id].includes(invite.id)
      );
      expect(testInvites).toHaveLength(2);
    });

    it("should not return accepted invites", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const pendingInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "pending@example.com"
      );
      const acceptedInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "accepted@example.com"
      );

      // Accept one invite
      await inviteRepository.invalidateInvite(acceptedInvite.id, randomUUID());

      // Act
      const result = await inviteRepository.findAllPending();

      // Assert
      const pendingIds = result.map((invite) => invite.id);
      expect(pendingIds).toContain(pendingInvite.id);
      expect(pendingIds).not.toContain(acceptedInvite.id);
    });

    it("should not return expired invites", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const validInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "valid@example.com"
      );
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const expiredInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "expired@example.com",
        expiredDate
      );

      // Act
      const result = await inviteRepository.findAllPending();

      // Assert
      const pendingIds = result.map((invite) => invite.id);
      expect(pendingIds).toContain(validInvite.id);
      expect(pendingIds).not.toContain(expiredInvite.id);
    });
  });

  describe("invalidateInvite", () => {
    it("should invalidate invite without acceptedBy", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const invite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "test@example.com"
      );

      // Act
      await inviteRepository.invalidateInvite(invite.id);

      // Assert
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        const updatedInvite = await prisma.invite.findUnique({
          where: { id: invite.id },
        });
        expect(updatedInvite!.acceptedAt).not.toBeNull();
        expect(updatedInvite!.acceptedBy).toBeNull();
      } finally {
        await prisma.$disconnect();
      }
    });

    it("should invalidate invite with acceptedBy", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const invite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "test@example.com"
      );
      const acceptedBy = randomUUID();

      // Act
      await inviteRepository.invalidateInvite(invite.id, acceptedBy);

      // Assert
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        const updatedInvite = await prisma.invite.findUnique({
          where: { id: invite.id },
        });
        expect(updatedInvite!.acceptedAt).not.toBeNull();
        expect(updatedInvite!.acceptedBy).toBe(acceptedBy);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("should throw not found error for non-existent invite", async () => {
      // Act & Assert
      await expect(
        inviteRepository.invalidateInvite(randomUUID())
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });
  });

  describe("deleteExpired", () => {
    it("should delete expired unaccepted invites", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const cutoffDate = new Date();
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      const expiredInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "expired@example.com",
        expiredDate
      );
      const validInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "valid@example.com"
      );

      // Act
      const deletedCount = await inviteRepository.deleteUnacceptedExpired(
        cutoffDate
      );

      // Assert
      expect(deletedCount).toBeGreaterThan(0);

      // Verify expired invite is deleted
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        const expiredCheck = await prisma.invite.findUnique({
          where: { id: expiredInvite.id },
        });
        const validCheck = await prisma.invite.findUnique({
          where: { id: validInvite.id },
        });

        expect(expiredCheck).toBeNull();
        expect(validCheck).not.toBeNull();
      } finally {
        await prisma.$disconnect();
      }

      // Remove from cleanup list since it's already deleted
      const expiredIndex = createdInviteIds.indexOf(expiredInvite.id);
      if (expiredIndex > -1) {
        createdInviteIds.splice(expiredIndex, 1);
      }
    });

    it("should not delete accepted expired invites", async () => {
      // Arrange
      const workspace = await createTestWorkspace();
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const expiredAcceptedInvite = await createTestInvite(
        workspace.id,
        workspace.ownerId,
        "expired-accepted@example.com",
        expiredDate
      );

      // Accept the expired invite
      await inviteRepository.invalidateInvite(
        expiredAcceptedInvite.id,
        randomUUID()
      );

      const cutoffDate = new Date();

      // Act
      const deletedCount = await inviteRepository.deleteUnacceptedExpired(
        cutoffDate
      );

      // Assert - The accepted invite should not be deleted
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        const acceptedCheck = await prisma.invite.findUnique({
          where: { id: expiredAcceptedInvite.id },
        });
        expect(acceptedCheck).not.toBeNull();
        expect(acceptedCheck!.acceptedAt).not.toBeNull();
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // Helper functions
  async function createTestWorkspace() {
    const workspace = await workspaceRepository.create(
      {
        name: `${TEST_PREFIX}-${randomUUID()}`,
        displayName: `Test Workspace ${randomUUID()}`,
        description: "Test workspace for invite repository tests",
        ownerId: randomUUID(),
        settings: {},
      },
      randomUUID()
    );

    createdWorkspaceIds.push(workspace.id);
    return workspace;
  }

  async function createTestInvite(
    workspaceId: string,
    inviterId: string,
    email: string,
    expiresAt?: Date
  ) {
    const inviteData: CreateWorkspaceInviteData = {
      workspaceId,
      inviterId,
      email,
      inviteToken: TokenUtils.generateSecureToken(),
      type: "workspace",
      role: "member",
      expiresAt: expiresAt || DateUtils.calculateExpirationDate(7),
    };

    const invite = await inviteRepository.create(inviteData);
    createdInviteIds.push(invite.id);
    return invite;
  }
});
