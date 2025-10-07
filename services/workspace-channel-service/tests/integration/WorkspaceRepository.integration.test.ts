import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { WorkspaceRepository } from "../../src/repositories/WorkspaceRepository";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import {
  CreateWorkspaceData,
  CreateWorkspaceMemberData,
} from "../../src/types";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { container } from "../../src/container"; // Auto-configured container
import { randomUUID } from "crypto";
import { it, describe, expect, beforeAll, afterEach } from "@jest/globals";

// Type assertion to avoid Prisma client typing issues during development
const prismaClientWithModels = (client: PrismaClient) => client as any;

// Test-specific prefix to avoid interference with other concurrent tests
const TEST_PREFIX = "workspace-repo-test-";

describe("WorkspaceRepository Integration Tests", () => {
  let prisma: PrismaClient;
  let workspaceRepository: IWorkspaceRepository;

  beforeAll(async () => {
    // Use container to resolve both PrismaClient and WorkspaceRepository with automatic DI
    prisma = container.resolve(PrismaClient);
    workspaceRepository = container.resolve<IWorkspaceRepository>(
      "IWorkspaceRepository"
    );
  });
  afterEach(async () => {
    // Clean up test data after each test to ensure clean state for next test
    const db = prismaClientWithModels(prisma);

    await db.channelMember.deleteMany({
      where: {
        channel: {
          workspace: {
            name: {
              startsWith: TEST_PREFIX,
            },
          },
        },
      },
    });

    await db.channel.deleteMany({
      where: {
        workspace: {
          name: {
            startsWith: TEST_PREFIX,
          },
        },
      },
    });

    await db.workspaceMember.deleteMany({
      where: {
        workspace: {
          name: {
            startsWith: TEST_PREFIX,
          },
        },
      },
    });

    await db.workspace.deleteMany({
      where: {
        name: {
          startsWith: TEST_PREFIX,
        },
      },
    });
  });

  describe("core functionality", () => {
    it("should create a workspace successfully with valid data", async () => {
      const testId = randomUUID();
      const validWorkspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}create-test-${testId}`,
        displayName: `Create Test ${testId}`,
        description: "A test workspace for integration testing",
        ownerId: randomUUID(),
        settings: { theme: "dark", notifications: true },
      };

      const result = await workspaceRepository.create(
        validWorkspaceData,
        validWorkspaceData.ownerId
      );

      expect(result).toMatchObject({
        name: validWorkspaceData.name,
        displayName: validWorkspaceData.displayName,
        description: validWorkspaceData.description,
        ownerId: validWorkspaceData.ownerId,
        settings: validWorkspaceData.settings,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should create workspace with minimal data", async () => {
      const testId = randomUUID();
      const minimalData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}minimal-test-${testId}`,
        displayName: `Minimal Test ${testId}`,
        ownerId: randomUUID(),
      };

      const result = await workspaceRepository.create(
        minimalData,
        minimalData.ownerId
      );

      expect(result).toMatchObject({
        name: minimalData.name,
        displayName: minimalData.displayName,
        description: null,
        ownerId: minimalData.ownerId,
        settings: {},
      });
    });

    it("should find workspace by name", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}find-test-${testId}`,
        displayName: `Find Test ${testId}`,
        ownerId: randomUUID(),
      };

      const createdWorkspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );
      const foundWorkspace = await workspaceRepository.findByName(
        workspaceData.name
      );

      // Compare individual fields instead of using toMatchObject with CreateWorkspaceData
      expect(foundWorkspace).toBeDefined();
      expect(foundWorkspace?.name).toBe(workspaceData.name);
      expect(foundWorkspace?.displayName).toBe(workspaceData.displayName);
      expect(foundWorkspace?.ownerId).toBe(workspaceData.ownerId);
      expect(foundWorkspace?.id).toBe(createdWorkspace.id);
    });

    it("should return null for non-existent workspace name", async () => {
      const testId = randomUUID();
      const result = await workspaceRepository.findByName(
        `${TEST_PREFIX}non-existent-${testId}`
      );
      expect(result).toBeNull();
    });

    it("should add workspace member successfully", async () => {
      const testId = randomUUID();
      // Create a test workspace first
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}member-test-${testId}`,
        displayName: `Member Test ${testId}`,
        ownerId: randomUUID(),
      };
      const testWorkspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      const memberData: CreateWorkspaceMemberData = {
        workspaceId: testWorkspace.id,
        userId: randomUUID(),
        role: "member",
        invitedBy: randomUUID(),
      };

      const result = await workspaceRepository.addMember(memberData);

      expect(result).toMatchObject({
        workspaceId: memberData.workspaceId,
        userId: memberData.userId,
        role: memberData.role,
        invitedBy: memberData.invitedBy,
      });
      expect(result.id).toBeDefined();
      expect(result.joinedAt).toBeDefined();
    });
  });

  describe("constraint validation", () => {
    it("should throw conflict error for duplicate workspace name", async () => {
      const testId = randomUUID();
      const baseName = `${TEST_PREFIX}duplicate-name-${testId}`;

      const firstWorkspace: CreateWorkspaceData = {
        name: baseName,
        displayName: `First Workspace ${testId}`,
        ownerId: randomUUID(),
      };

      // Create first workspace
      const created = await workspaceRepository.create(
        firstWorkspace,
        firstWorkspace.ownerId
      );

      // Try to create workspace with same name
      const duplicateData: CreateWorkspaceData = {
        name: baseName, // Same name - this should cause conflict
        displayName: `Different Display Name ${testId}`,
        ownerId: randomUUID(),
      };
      await expect(
        workspaceRepository.create(duplicateData, duplicateData.ownerId)
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceRepository.create(duplicateData, duplicateData.ownerId)
      ).rejects.toThrow(`Workspace name '${baseName}' is already taken`);
    });

    it("should throw conflict error for duplicate display name", async () => {
      const testId = randomUUID();
      const baseDisplayName = `Duplicate Display Name Test ${testId}`;

      const firstWorkspace: CreateWorkspaceData = {
        name: `${TEST_PREFIX}first-${testId}`,
        displayName: baseDisplayName,
        ownerId: randomUUID(),
      };

      // Create first workspace
      const created = await workspaceRepository.create(
        firstWorkspace,
        firstWorkspace.ownerId
      );

      // Try to create workspace with same display name
      const duplicateData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}second-${testId}`,
        displayName: baseDisplayName, // Same display name - this should cause conflict
        ownerId: randomUUID(),
      };

      await expect(
        workspaceRepository.create(duplicateData, duplicateData.ownerId)
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        workspaceRepository.create(duplicateData, duplicateData.ownerId)
      ).rejects.toThrow(
        `Workspace display name '${baseDisplayName}' is already taken`
      );
    });

    it("should throw conflict error for duplicate membership", async () => {
      const testId = randomUUID();
      // Create a test workspace first
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}member-duplicate-${testId}`,
        displayName: `Member Duplicate Test ${testId}`,
        ownerId: randomUUID(),
      };
      const testWorkspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      const userId = randomUUID();
      const memberData: CreateWorkspaceMemberData = {
        workspaceId: testWorkspace.id,
        userId: userId,
        role: "member",
        invitedBy: randomUUID(),
      };

      // Add member first time
      const firstMember = await workspaceRepository.addMember(memberData);

      // Try to add same user again
      await expect(workspaceRepository.addMember(memberData)).rejects.toThrow(
        WorkspaceChannelServiceError
      );

      await expect(workspaceRepository.addMember(memberData)).rejects.toThrow(
        "User is already a member of this workspace"
      );
    });

    it("should handle foreign key constraint for non-existent workspace", async () => {
      const memberData: CreateWorkspaceMemberData = {
        workspaceId: randomUUID(), // Non-existent workspace ID
        userId: randomUUID(),
        role: "member",
        invitedBy: randomUUID(),
      };

      await expect(workspaceRepository.addMember(memberData)).rejects.toThrow(
        WorkspaceChannelServiceError
      );
    });
  });

  describe("findById", () => {
    it("should find workspace by ID when it exists", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}findbyid-test-${testId}`,
        displayName: `Find By ID Test ${testId}`,
        description: "Test workspace for findById",
        ownerId: randomUUID(),
        settings: { theme: "light" },
      };

      const createdWorkspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      const foundWorkspace = await workspaceRepository.findById(
        createdWorkspace.id
      );

      expect(foundWorkspace).toBeDefined();
      expect(foundWorkspace?.id).toBe(createdWorkspace.id);
      expect(foundWorkspace?.name).toBe(workspaceData.name);
      expect(foundWorkspace?.displayName).toBe(workspaceData.displayName);
      expect(foundWorkspace?.description).toBe(workspaceData.description);
      expect(foundWorkspace?.ownerId).toBe(workspaceData.ownerId);
      expect(foundWorkspace?.settings).toEqual(workspaceData.settings);
    });

    it("should return null when workspace does not exist", async () => {
      const nonExistentId = randomUUID();
      const result = await workspaceRepository.findById(nonExistentId);

      expect(result).toBeNull();
    });

    it("should find archived workspace", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}archived-test-${testId}`,
        displayName: `Archived Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Manually archive the workspace
      const db = prismaClientWithModels(prisma);
      await db.workspace.update({
        where: { id: workspace.id },
        data: { isArchived: true },
      });

      const foundWorkspace = await workspaceRepository.findById(workspace.id);

      expect(foundWorkspace).toBeDefined();
      expect(foundWorkspace?.isArchived).toBe(true);
    });
  });

  describe("getMembership", () => {
    it("should get membership when user is a member", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}membership-test-${testId}`,
        displayName: `Membership Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Owner should have a membership (created automatically)
      const membership = await workspaceRepository.getMembership(
        workspaceData.ownerId,
        workspace.id
      );

      expect(membership).toBeDefined();
      expect(membership?.userId).toBe(workspaceData.ownerId);
      expect(membership?.workspaceId).toBe(workspace.id);
      expect(membership?.role).toBe("owner");
      expect(membership?.isActive).toBe(true);
    });

    it("should return null when user is not a member", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}non-member-test-${testId}`,
        displayName: `Non Member Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      const nonMemberId = randomUUID();
      const membership = await workspaceRepository.getMembership(
        nonMemberId,
        workspace.id
      );

      expect(membership).toBeNull();
    });

    it("should return null for non-existent workspace", async () => {
      const userId = randomUUID();
      const nonExistentWorkspaceId = randomUUID();

      const membership = await workspaceRepository.getMembership(
        userId,
        nonExistentWorkspaceId
      );

      expect(membership).toBeNull();
    });

    it("should get membership with different roles", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}roles-test-${testId}`,
        displayName: `Roles Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Add members with different roles
      const adminUserId = randomUUID();
      const memberUserId = randomUUID();
      const guestUserId = randomUUID();

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: adminUserId,
        role: "admin",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: memberUserId,
        role: "member",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: guestUserId,
        role: "guest",
      });

      // Verify all roles
      const ownerMembership = await workspaceRepository.getMembership(
        workspaceData.ownerId,
        workspace.id
      );
      expect(ownerMembership?.role).toBe("owner");

      const adminMembership = await workspaceRepository.getMembership(
        adminUserId,
        workspace.id
      );
      expect(adminMembership?.role).toBe("admin");

      const memberMembership = await workspaceRepository.getMembership(
        memberUserId,
        workspace.id
      );
      expect(memberMembership?.role).toBe("member");

      const guestMembership = await workspaceRepository.getMembership(
        guestUserId,
        workspace.id
      );
      expect(guestMembership?.role).toBe("guest");
    });

    it("should get inactive membership", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}inactive-test-${testId}`,
        displayName: `Inactive Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      const userId = randomUUID();
      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: userId,
        role: "member",
      });

      // Deactivate the membership
      const db = prismaClientWithModels(prisma);
      await db.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: userId,
          },
        },
        data: { isActive: false },
      });

      const membership = await workspaceRepository.getMembership(
        userId,
        workspace.id
      );

      expect(membership).toBeDefined();
      expect(membership?.isActive).toBe(false);
    });
  });

  describe("countActiveMembers", () => {
    it("should count only active members", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}count-active-${testId}`,
        displayName: `Count Active Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Add 3 active members
      const user1 = randomUUID();
      const user2 = randomUUID();
      const user3 = randomUUID();

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: user1,
        role: "member",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: user2,
        role: "member",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: user3,
        role: "admin",
      });

      // Count should be 4 (owner + 3 members)
      const count = await workspaceRepository.countActiveMembers(workspace.id);
      expect(count).toBe(4);
    });

    it("should not count inactive members", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}count-inactive-${testId}`,
        displayName: `Count Inactive Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Add 2 members
      const user1 = randomUUID();
      const user2 = randomUUID();

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: user1,
        role: "member",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: user2,
        role: "member",
      });

      // Deactivate one member
      const db = prismaClientWithModels(prisma);
      await db.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user1,
          },
        },
        data: { isActive: false },
      });

      // Count should be 2 (owner + 1 active member)
      const count = await workspaceRepository.countActiveMembers(workspace.id);
      expect(count).toBe(2);
    });

    it("should return 0 for non-existent workspace", async () => {
      const nonExistentId = randomUUID();
      const count = await workspaceRepository.countActiveMembers(nonExistentId);
      expect(count).toBe(0);
    });

    it("should count only owner when no other members", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}count-owner-only-${testId}`,
        displayName: `Count Owner Only Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      const count = await workspaceRepository.countActiveMembers(workspace.id);
      expect(count).toBe(1); // Only the owner
    });

    it("should handle workspace with all inactive members", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}count-all-inactive-${testId}`,
        displayName: `Count All Inactive Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Deactivate the owner membership
      const db = prismaClientWithModels(prisma);
      await db.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: workspaceData.ownerId,
          },
        },
        data: { isActive: false },
      });

      const count = await workspaceRepository.countActiveMembers(workspace.id);
      expect(count).toBe(0);
    });

    it("should count members correctly with mixed roles", async () => {
      const testId = randomUUID();
      const workspaceData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}count-mixed-roles-${testId}`,
        displayName: `Count Mixed Roles Test ${testId}`,
        ownerId: randomUUID(),
      };

      const workspace = await workspaceRepository.create(
        workspaceData,
        workspaceData.ownerId
      );

      // Add members with different roles
      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: randomUUID(),
        role: "admin",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: randomUUID(),
        role: "member",
      });

      await workspaceRepository.addMember({
        workspaceId: workspace.id,
        userId: randomUUID(),
        role: "guest",
      });

      // All roles should be counted
      const count = await workspaceRepository.countActiveMembers(workspace.id);
      expect(count).toBe(4); // owner + admin + member + guest
    });
  });
});
