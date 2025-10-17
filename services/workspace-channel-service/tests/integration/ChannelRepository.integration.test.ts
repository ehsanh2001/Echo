import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { IChannelRepository } from "../../src/interfaces/repositories/IChannelRepository";
import {
  CreateChannelData,
  CreateChannelMemberData,
  CreateWorkspaceData,
} from "../../src/types";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { container } from "../../src/container"; // Auto-configured container
import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";

// Type assertion to avoid Prisma client typing issues during development
const prismaClientWithModels = (client: PrismaClient) => client as any;

// Test-specific prefix to avoid interference with other concurrent tests
const TEST_PREFIX = "channel-repo-test-";

// Helper function to create a test workspace with prefixed name
const createTestWorkspace = async (
  db: any,
  label: string,
  overrides: Partial<CreateWorkspaceData> = {}
) => {
  const testId = randomUUID();
  const workspaceData: CreateWorkspaceData = {
    name: overrides.name ?? `${TEST_PREFIX}${label}-${testId}`,
    displayName: overrides.displayName ?? `${label} ${testId}`,
    ownerId: overrides.ownerId ?? randomUUID(),
    settings: overrides.settings ?? {},
  };

  if (overrides.description !== undefined) {
    workspaceData.description = overrides.description;
  }

  return await db.workspace.create({
    data: workspaceData,
  });
};

// Helper function to create a test channel with prefixed name
const createTestChannel = async (
  channelRepo: IChannelRepository,
  workspaceId: string,
  label: string,
  overrides: Partial<CreateChannelData> = {}
) => {
  const testId = randomUUID();
  const creatorId = overrides.createdBy ?? randomUUID();
  const channelData: CreateChannelData = {
    workspaceId,
    name: overrides.name ?? `${TEST_PREFIX}${label}-${testId}`,
    type: overrides.type ?? "public",
    createdBy: creatorId,
    memberCount: overrides.memberCount ?? 0,
    settings: overrides.settings ?? {},
    ...(overrides.displayName !== undefined && {
      displayName: overrides.displayName,
    }),
    ...(overrides.description !== undefined && {
      description: overrides.description,
    }),
  };

  return await channelRepo.create(channelData, creatorId);
};

describe("ChannelRepository Integration Tests", () => {
  let prisma: PrismaClient;
  let channelRepository: IChannelRepository;

  beforeAll(async () => {
    // Use container to resolve both PrismaClient and ChannelRepository with automatic DI
    prisma = container.resolve(PrismaClient);
    channelRepository =
      container.resolve<IChannelRepository>("IChannelRepository");
  });

  afterEach(async () => {
    // Clean up test data after each test to ensure clean state for next test
    const db = prismaClientWithModels(prisma);

    await db.invite.deleteMany({
      where: {
        workspace: {
          name: {
            startsWith: TEST_PREFIX,
          },
        },
      },
    });

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
    it("should create a channel successfully with valid data", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "channel-test");

      const result = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "general",
        {
          displayName: "General Channel",
          description: "A test channel for integration testing",
          settings: { notifications: true },
        }
      );

      expect(result).toMatchObject({
        displayName: "General Channel",
        description: "A test channel for integration testing",
        type: "public",
        workspaceId: testWorkspace.id,
        memberCount: 1,
        settings: { notifications: true },
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should create channel with minimal data", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "minimal-test");

      const result = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "random",
        {
          type: "private",
        }
      );

      expect(result).toMatchObject({
        displayName: null,
        description: null,
        type: "private",
        workspaceId: testWorkspace.id,
        memberCount: 1,
        settings: {},
      });
      expect(result.isArchived).toBe(false);
      expect(result.isReadOnly).toBe(false);
    });

    it("should add channel member successfully", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "member-test");

      const testChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "test-channel"
      );

      const memberData: CreateChannelMemberData = {
        channelId: testChannel.id,
        userId: randomUUID(),
        role: "member",
        joinedBy: randomUUID(),
      };

      const result = await channelRepository.addOrReactivateMember(
        memberData.channelId,
        memberData.userId,
        memberData.joinedBy!,
        memberData.role
      );

      expect(result).toMatchObject({
        channelId: memberData.channelId,
        userId: memberData.userId,
        role: memberData.role,
        joinedBy: memberData.joinedBy,
      });
      expect(result.id).toBeDefined();
      expect(result.joinedAt).toBeDefined();
      expect(result.isMuted).toBe(false);
      expect(result.isActive).toBe(true);

      const updatedChannel = await db.channel.findUnique({
        where: { id: testChannel.id },
      });

      expect(updatedChannel?.memberCount).toBe(2);
    });

    it("should add channel member with minimal data", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "minimal-member");

      const testChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "minimal-channel",
        {
          type: "private",
        }
      );

      const minimalMemberData: CreateChannelMemberData = {
        channelId: testChannel.id,
        userId: randomUUID(),
        role: "viewer",
      };

      const result = await channelRepository.addOrReactivateMember(
        minimalMemberData.channelId,
        minimalMemberData.userId,
        "", // No joinedBy for minimal data
        minimalMemberData.role
      );

      expect(result).toMatchObject({
        channelId: minimalMemberData.channelId,
        userId: minimalMemberData.userId,
        role: minimalMemberData.role,
        joinedBy: null,
      });

      const updatedChannel = await db.channel.findUnique({
        where: { id: testChannel.id },
      });

      expect(updatedChannel?.memberCount).toBe(2);
    });
  });

  describe("constraint validation", () => {
    it("should throw conflict error for duplicate channel name in same workspace", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "duplicate-test");
      const channelName = `${TEST_PREFIX}duplicate-channel`;

      const creatorId1 = randomUUID();
      const firstChannelData: CreateChannelData = {
        workspaceId: testWorkspace.id,
        name: channelName,
        displayName: "First Channel",
        type: "public",
        createdBy: creatorId1,
        memberCount: 1,
        settings: {},
      };

      // Create first channel
      const created = await channelRepository.create(
        firstChannelData,
        creatorId1
      );

      // Try to create channel with same name in same workspace
      const creatorId2 = randomUUID();
      const duplicateData: CreateChannelData = {
        workspaceId: testWorkspace.id,
        name: channelName, // Same name in same workspace - should cause conflict
        displayName: "Second Channel",
        type: "private",
        createdBy: creatorId2,
        memberCount: 1,
        settings: {},
      };

      await expect(
        channelRepository.create(duplicateData, creatorId2)
      ).rejects.toThrow(WorkspaceChannelServiceError);

      await expect(
        channelRepository.create(duplicateData, creatorId2)
      ).rejects.toThrow(
        `Channel name '${channelName}' already exists in this workspace`
      );
    });

    it("should allow same channel name in different workspaces", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace1 = await createTestWorkspace(db, "workspace1");
      const testWorkspace2 = await createTestWorkspace(db, "workspace2");
      const channelName = `${TEST_PREFIX}same-name-channel`;

      const creatorId1 = randomUUID();
      const channelData1: CreateChannelData = {
        workspaceId: testWorkspace1.id,
        name: channelName,
        type: "public",
        createdBy: creatorId1,
        memberCount: 1,
        settings: {},
      };

      const creatorId2 = randomUUID();
      const channelData2: CreateChannelData = {
        workspaceId: testWorkspace2.id,
        name: channelName, // Same name but different workspace - should be allowed
        type: "private",
        createdBy: creatorId2,
        memberCount: 1,
        settings: {},
      };

      // Should create both channels successfully
      const result1 = await channelRepository.create(channelData1, creatorId1);
      const result2 = await channelRepository.create(channelData2, creatorId2);

      expect(result1.name).toBe(channelName);
      expect(result2.name).toBe(channelName);
      expect(result1.workspaceId).toBe(testWorkspace1.id);
      expect(result2.workspaceId).toBe(testWorkspace2.id);
      expect(result1.id).not.toBe(result2.id);
    });

    it("should reactivate inactive member when adding duplicate membership", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "member-duplicate");

      const testChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "duplicate-member-channel"
      );

      const userId = randomUUID();
      const joinedBy = randomUUID();

      // Add member first time
      const firstMember = await channelRepository.addOrReactivateMember(
        testChannel.id,
        userId,
        joinedBy,
        "member"
      );
      expect(firstMember.isActive).toBe(true);

      // Deactivate the member manually
      await db.channelMember.update({
        where: { id: firstMember.id },
        data: { isActive: false },
      });

      // Update channel count manually
      await db.channel.update({
        where: { id: testChannel.id },
        data: { memberCount: { decrement: 1 } },
      });

      // Try to add same user again - should reactivate
      const secondMember = await channelRepository.addOrReactivateMember(
        testChannel.id,
        userId,
        joinedBy,
        "member"
      );

      expect(secondMember.isActive).toBe(true);
      expect(secondMember.id).toBe(firstMember.id); // Same record

      const channelAfterReactivation = await db.channel.findUnique({
        where: { id: testChannel.id },
      });

      // Member count should be back to 2 (creator + reactivated member)
      expect(channelAfterReactivation?.memberCount).toBe(2);
    });

    it("should handle foreign key constraint for non-existent channel", async () => {
      const invalidChannelId = randomUUID(); // Non-existent channel ID
      const userId = randomUUID();
      const joinedBy = randomUUID();

      await expect(
        channelRepository.addOrReactivateMember(
          invalidChannelId,
          userId,
          joinedBy,
          "member"
        )
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });

    it("should handle foreign key constraint for non-existent workspace", async () => {
      const creatorId = randomUUID();
      const invalidChannelData: CreateChannelData = {
        workspaceId: randomUUID(), // Non-existent workspace ID
        name: `${TEST_PREFIX}invalid-workspace-channel`,
        type: "public",
        createdBy: creatorId,
        memberCount: 1,
        settings: {},
      };

      await expect(
        channelRepository.create(invalidChannelData, creatorId)
      ).rejects.toThrow(WorkspaceChannelServiceError);
    });
  });

  describe("new repository methods", () => {
    it("should find channel by name in workspace", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "findbyname-test");

      // Create a channel
      const channel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "test-channel"
      );

      // Find the channel by name
      const foundChannel = await channelRepository.findByNameInWorkspace(
        testWorkspace.id,
        channel.name
      );

      expect(foundChannel).toBeDefined();
      expect(foundChannel?.id).toBe(channel.id);
      expect(foundChannel?.name).toBe(channel.name);
      expect(foundChannel?.workspaceId).toBe(testWorkspace.id);
    });

    it("should return null when channel name not found in workspace", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(
        db,
        "findbyname-notfound"
      );

      const foundChannel = await channelRepository.findByNameInWorkspace(
        testWorkspace.id,
        "non-existent-channel"
      );

      expect(foundChannel).toBeNull();
    });

    it("should not find channel from different workspace", async () => {
      const db = prismaClientWithModels(prisma);
      const workspace1 = await createTestWorkspace(db, "findbyname-ws1");
      const workspace2 = await createTestWorkspace(db, "findbyname-ws2");

      // Create channel in workspace1
      const channel = await createTestChannel(
        channelRepository,
        workspace1.id,
        "shared-name"
      );

      // Try to find it in workspace2
      const foundChannel = await channelRepository.findByNameInWorkspace(
        workspace2.id,
        channel.name
      );

      expect(foundChannel).toBeNull();
    });

    it("should add multiple members to channel atomically", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "addmembers-test");
      const channel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "multi-member-channel"
      );

      const user1Id = randomUUID();
      const user2Id = randomUUID();
      const user3Id = randomUUID();
      const addedById = randomUUID();

      const members = [
        { userId: user1Id, role: "member", joinedBy: addedById },
        { userId: user2Id, role: "member", joinedBy: addedById },
        { userId: user3Id, role: "admin", joinedBy: addedById },
      ];

      const result = await channelRepository.addMembers(
        channel.id,
        members,
        undefined
      );

      // Verify all members were added
      expect(result).toHaveLength(3);
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0]!.userId).toBe(user1Id);
      expect(result[0]!.role).toBe("member");
      expect(result[1]!.userId).toBe(user2Id);
      expect(result[2]!.userId).toBe(user3Id);
      expect(result[2]!.role).toBe("admin");

      // Verify member count was incremented
      const updatedChannel = await db.channel.findUnique({
        where: { id: channel.id },
      });
      expect(updatedChannel.memberCount).toBe(channel.memberCount + 3);
    });

    it("should handle addMembers with transaction", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(
        db,
        "addmembers-transaction"
      );
      const channel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "transaction-channel"
      );

      const userId = randomUUID();
      const addedById = randomUUID();

      await prisma.$transaction(async (tx) => {
        const members = [{ userId, role: "member", joinedBy: addedById }];

        const result = await channelRepository.addMembers(
          channel.id,
          members,
          tx
        );

        expect(result).toHaveLength(1);
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result[0]!.userId).toBe(userId);
      });

      // Verify member was added after transaction
      const channelMember = await db.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: channel.id,
            userId,
          },
        },
      });

      expect(channelMember).toBeDefined();
      expect(channelMember.isActive).toBe(true);
    });

    it("should support create with external transaction", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "create-transaction");
      const creatorId = randomUUID();

      let channelId: string | undefined;

      await prisma.$transaction(async (tx) => {
        const channelData: CreateChannelData = {
          workspaceId: testWorkspace.id,
          name: `${TEST_PREFIX}tx-channel-${randomUUID()}`,
          type: "private",
          createdBy: creatorId,
          memberCount: 1,
          settings: {},
        };

        const channel = await channelRepository.create(
          channelData,
          creatorId,
          tx
        );

        channelId = channel.id;
        expect(channel.name).toBe(channelData.name);
        expect(channel.type).toBe("private");
      });

      // Verify channel was created after transaction commits
      expect(channelId).toBeDefined();
      const createdChannel = await db.channel.findUnique({
        where: { id: channelId! },
      });

      expect(createdChannel).toBeDefined();
      expect(createdChannel.workspaceId).toBe(testWorkspace.id);

      // Verify creator was added as member
      const creatorMember = await db.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: channelId!,
            userId: creatorId,
          },
        },
      });

      expect(creatorMember).toBeDefined();
      expect(creatorMember.role).toBe("owner");
    });

    it("should rollback addMembers on transaction failure", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "rollback-test");
      const channel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "rollback-channel"
      );

      const initialMemberCount = channel.memberCount;
      const userId = randomUUID();

      try {
        await prisma.$transaction(async (tx) => {
          const members = [{ userId, role: "member", joinedBy: randomUUID() }];

          await channelRepository.addMembers(channel.id, members, tx);

          // Force a rollback by throwing an error
          throw new Error("Intentional rollback");
        });
      } catch (error: any) {
        expect(error.message).toBe("Intentional rollback");
      }

      // Verify member was NOT added (transaction rolled back)
      const channelMember = await db.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: channel.id,
            userId,
          },
        },
      });

      expect(channelMember).toBeNull();

      // Verify member count was NOT incremented
      const updatedChannel = await db.channel.findUnique({
        where: { id: channel.id },
      });
      expect(updatedChannel.memberCount).toBe(initialMemberCount);
    });
  });
});
