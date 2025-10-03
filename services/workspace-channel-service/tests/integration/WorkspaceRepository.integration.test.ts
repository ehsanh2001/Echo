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

      const result = await workspaceRepository.create(validWorkspaceData);

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

      const result = await workspaceRepository.create(minimalData);

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

      const createdWorkspace = await workspaceRepository.create(workspaceData);
      const foundWorkspace = await workspaceRepository.findByName(
        workspaceData.name
      );

      expect(foundWorkspace).toMatchObject(workspaceData);
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
      const testWorkspace = await workspaceRepository.create(workspaceData);

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
      const created = await workspaceRepository.create(firstWorkspace);

      // Try to create workspace with same name
      const duplicateData: CreateWorkspaceData = {
        name: baseName, // Same name - this should cause conflict
        displayName: `Different Display Name ${testId}`,
        ownerId: randomUUID(),
      };
      await expect(workspaceRepository.create(duplicateData)).rejects.toThrow(
        WorkspaceChannelServiceError
      );

      await expect(workspaceRepository.create(duplicateData)).rejects.toThrow(
        `Workspace name '${baseName}' is already taken`
      );
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
      const created = await workspaceRepository.create(firstWorkspace);

      // Try to create workspace with same display name
      const duplicateData: CreateWorkspaceData = {
        name: `${TEST_PREFIX}second-${testId}`,
        displayName: baseDisplayName, // Same display name - this should cause conflict
        ownerId: randomUUID(),
      };

      await expect(workspaceRepository.create(duplicateData)).rejects.toThrow(
        WorkspaceChannelServiceError
      );

      await expect(workspaceRepository.create(duplicateData)).rejects.toThrow(
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
      const testWorkspace = await workspaceRepository.create(workspaceData);

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
});
