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

  describe("getChannelMembershipsByUserId", () => {
    let testWorkspace: any;

    beforeEach(async () => {
      // Create a test workspace for all channel tests
      testWorkspace = await createTestWorkspace(
        prismaClientWithModels(prisma),
        "membership-test"
      );
    });

    it("should return user's channel memberships sorted alphabetically", async () => {
      const userId = randomUUID();

      // Create multiple channels
      const channel1 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "middle-channel",
        {
          name: `${TEST_PREFIX}middle-${randomUUID()}`,
          type: "public",
        }
      );

      const channel2 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "alpha-channel",
        {
          name: `${TEST_PREFIX}alpha-${randomUUID()}`,
          type: "private",
        }
      );

      const channel3 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "zulu-channel",
        {
          name: `${TEST_PREFIX}zulu-${randomUUID()}`,
          type: "public",
        }
      );

      // Add user to channels 2 and 3 (user is already member of channel1 as creator)
      await channelRepository.addOrReactivateMember(
        channel2.id,
        userId,
        randomUUID(),
        "admin"
      );

      await channelRepository.addOrReactivateMember(
        channel3.id,
        userId,
        randomUUID(),
        "member"
      );

      const result = await channelRepository.getChannelMembershipsByUserId(
        userId,
        testWorkspace.id
      );

      expect(result).toHaveLength(2); // Should not include channel1 as user is not a member

      // Should be sorted alphabetically by channel name
      const firstResult = result[0];
      const secondResult = result[1];
      if (!firstResult || !secondResult) throw new Error("Test data missing");

      expect(firstResult.channel.name).toContain("alpha");
      expect(secondResult.channel.name).toContain("zulu");

      // Check channel and membership data
      expect(firstResult.channel.id).toBe(channel2.id);
      expect(firstResult.membership.role).toBe("admin");
      expect(firstResult.membership.userId).toBe(userId);

      expect(secondResult.channel.id).toBe(channel3.id);
      expect(secondResult.membership.role).toBe("member");
      expect(secondResult.membership.userId).toBe(userId);
    });

    it("should exclude archived channels", async () => {
      const userId = randomUUID();

      const activeChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "active",
        {
          type: "public",
        }
      );

      const archivedChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "archived",
        {
          type: "public",
        }
      );

      // Add user to both channels
      await channelRepository.addOrReactivateMember(
        activeChannel.id,
        userId,
        randomUUID(),
        "member"
      );

      await channelRepository.addOrReactivateMember(
        archivedChannel.id,
        userId,
        randomUUID(),
        "member"
      );

      // Archive one channel
      const db = prismaClientWithModels(prisma);
      await db.channel.update({
        where: { id: archivedChannel.id },
        data: { isArchived: true },
      });

      const result = await channelRepository.getChannelMembershipsByUserId(
        userId,
        testWorkspace.id
      );

      // Should only return the active channel
      expect(result).toHaveLength(1);
      const firstResult = result[0];
      if (!firstResult) throw new Error("Test data missing");
      expect(firstResult.channel.id).toBe(activeChannel.id);
    });

    it("should exclude direct channels", async () => {
      const userId = randomUUID();

      const publicChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "public",
        {
          type: "public",
        }
      );

      const directChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "direct",
        {
          type: "direct",
        }
      );

      // Add user to both channels
      await channelRepository.addOrReactivateMember(
        publicChannel.id,
        userId,
        randomUUID(),
        "member"
      );

      await channelRepository.addOrReactivateMember(
        directChannel.id,
        userId,
        randomUUID(),
        "member"
      );

      const result = await channelRepository.getChannelMembershipsByUserId(
        userId,
        testWorkspace.id
      );

      // Should only return the public channel (direct channel excluded)
      expect(result).toHaveLength(1);
      const firstResult = result[0];
      if (!firstResult) throw new Error("Test data missing");
      expect(firstResult.channel.id).toBe(publicChannel.id);
      expect(firstResult.channel.type).toBe("public");
    });

    it("should only return active memberships", async () => {
      const userId = randomUUID();

      const channel1 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "active-membership",
        {
          type: "public",
        }
      );

      const channel2 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "inactive-membership",
        {
          type: "public",
        }
      );

      // Add user to both channels
      const membership1 = await channelRepository.addOrReactivateMember(
        channel1.id,
        userId,
        randomUUID(),
        "member"
      );

      const membership2 = await channelRepository.addOrReactivateMember(
        channel2.id,
        userId,
        randomUUID(),
        "member"
      );

      // Deactivate one membership
      const db = prismaClientWithModels(prisma);
      await db.channelMember.update({
        where: { id: membership2.id },
        data: { isActive: false },
      });

      const result = await channelRepository.getChannelMembershipsByUserId(
        userId,
        testWorkspace.id
      );

      // Should only return the active membership
      expect(result).toHaveLength(1);
      const firstResult = result[0];
      if (!firstResult) throw new Error("Test data missing");
      expect(firstResult.channel.id).toBe(channel1.id);
      expect(firstResult.membership.isActive).toBe(true);
    });

    it("should return empty array for user with no memberships", async () => {
      const userId = randomUUID();

      const result = await channelRepository.getChannelMembershipsByUserId(
        userId,
        testWorkspace.id
      );

      expect(result).toHaveLength(0);
    });

    it("should return empty array for non-existent workspace", async () => {
      const userId = randomUUID();
      const nonExistentWorkspaceId = randomUUID();

      const result = await channelRepository.getChannelMembershipsByUserId(
        userId,
        nonExistentWorkspaceId
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("getChannelMembersByWorkspace", () => {
    it("should return channel members for channels user belongs to", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "members-test");
      const userId = randomUUID();

      // Create two channels - use userId as creator so they're automatically added
      const channel1 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "channel-1",
        { type: "public", createdBy: userId }
      );

      const channel2 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "channel-2",
        { type: "private", createdBy: userId }
      );

      // Add other members to both channels
      const otherUser1 = randomUUID();
      const otherUser2 = randomUUID();

      await channelRepository.addOrReactivateMember(
        channel1.id,
        otherUser1,
        userId,
        "member"
      );

      await channelRepository.addOrReactivateMember(
        channel2.id,
        otherUser2,
        userId,
        "member"
      );

      const result = await channelRepository.getChannelMembersByWorkspace(
        testWorkspace.id,
        userId
      );

      // Should return 2 channels with their members
      expect(result).toHaveLength(2);

      // Check channel 1 - should have userId (owner) + otherUser1 (member)
      const channel1Result = result.find((c) => c.channelId === channel1.id);
      expect(channel1Result).toBeDefined();
      expect(channel1Result?.channelName).toBe(channel1.name);
      expect(channel1Result?.channelType).toBe("public");
      expect(channel1Result?.members).toHaveLength(2);

      const channel1UserIds = channel1Result?.members.map((m) => m.userId);
      expect(channel1UserIds).toContain(userId);
      expect(channel1UserIds).toContain(otherUser1);

      // Check channel 2
      const channel2Result = result.find((c) => c.channelId === channel2.id);
      expect(channel2Result).toBeDefined();
      expect(channel2Result?.channelName).toBe(channel2.name);
      expect(channel2Result?.channelType).toBe("private");
      expect(channel2Result?.members).toHaveLength(2);

      const channel2UserIds = channel2Result?.members.map((m) => m.userId);
      expect(channel2UserIds).toContain(userId);
      expect(channel2UserIds).toContain(otherUser2);
    });

    it("should return empty array when user has no channels", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "no-channels-test");
      const userId = randomUUID();

      const result = await channelRepository.getChannelMembersByWorkspace(
        testWorkspace.id,
        userId
      );

      expect(result).toHaveLength(0);
    });

    it("should exclude archived channels", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "archived-test");
      const userId = randomUUID();

      // Create two channels
      const activeChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "active-channel",
        { type: "public" }
      );

      const archivedChannel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "archived-channel",
        { type: "public" }
      );

      // Add user to both channels
      await channelRepository.addOrReactivateMember(
        activeChannel.id,
        userId,
        userId,
        "member"
      );
      await channelRepository.addOrReactivateMember(
        archivedChannel.id,
        userId,
        userId,
        "member"
      );

      // Archive one channel
      await db.channel.update({
        where: { id: archivedChannel.id },
        data: { isArchived: true },
      });

      const result = await channelRepository.getChannelMembersByWorkspace(
        testWorkspace.id,
        userId
      );

      // Should only return the active channel
      expect(result).toHaveLength(1);
      expect(result[0]?.channelId).toBe(activeChannel.id);
    });

    it("should exclude inactive members", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(
        db,
        "inactive-member-test"
      );
      const userId = randomUUID();
      const activeMember = randomUUID();
      const inactiveMember = randomUUID();

      // Create a channel with userId as creator (automatically added as owner)
      const channel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "test-channel",
        { type: "public", createdBy: userId }
      );

      // Add two more members
      await channelRepository.addOrReactivateMember(
        channel.id,
        activeMember,
        userId,
        "member"
      );
      const inactiveMembership = await channelRepository.addOrReactivateMember(
        channel.id,
        inactiveMember,
        userId,
        "member"
      );

      // Deactivate one member
      await db.channelMember.update({
        where: { id: inactiveMembership.id },
        data: { isActive: false },
      });

      const result = await channelRepository.getChannelMembersByWorkspace(
        testWorkspace.id,
        userId
      );

      // Should return channel with only active members (userId + activeMember)
      expect(result).toHaveLength(1);
      expect(result[0]?.members).toHaveLength(2);

      const memberUserIds = result[0]?.members.map((m) => m.userId);
      expect(memberUserIds).toContain(userId);
      expect(memberUserIds).toContain(activeMember);
      expect(memberUserIds).not.toContain(inactiveMember);
    });

    it("should only return channels in the specified workspace", async () => {
      const db = prismaClientWithModels(prisma);
      const workspace1 = await createTestWorkspace(db, "workspace-1");
      const workspace2 = await createTestWorkspace(db, "workspace-2");
      const userId = randomUUID();

      // Create channels in both workspaces
      const channel1 = await createTestChannel(
        channelRepository,
        workspace1.id,
        "channel-1",
        { type: "public" }
      );

      const channel2 = await createTestChannel(
        channelRepository,
        workspace2.id,
        "channel-2",
        { type: "public" }
      );

      // Add user to both channels
      await channelRepository.addOrReactivateMember(
        channel1.id,
        userId,
        userId,
        "member"
      );
      await channelRepository.addOrReactivateMember(
        channel2.id,
        userId,
        userId,
        "member"
      );

      // Query for workspace1 channels only
      const result = await channelRepository.getChannelMembersByWorkspace(
        workspace1.id,
        userId
      );

      // Should only return channel1 from workspace1
      expect(result).toHaveLength(1);
      expect(result[0]?.channelId).toBe(channel1.id);
    });

    it("should include member roles and joinedAt dates", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "roles-test");
      const ownerId = randomUUID();
      const adminId = randomUUID();
      const memberId = randomUUID();

      // Create a channel with ownerId as creator (automatically added as owner)
      const channel = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "roles-channel",
        { type: "public", createdBy: ownerId }
      );

      // Add members with different roles (ownerId already added as owner by createTestChannel)
      await channelRepository.addOrReactivateMember(
        channel.id,
        adminId,
        ownerId,
        "admin"
      );
      await channelRepository.addOrReactivateMember(
        channel.id,
        memberId,
        ownerId,
        "member"
      );

      const result = await channelRepository.getChannelMembersByWorkspace(
        testWorkspace.id,
        ownerId
      );

      expect(result).toHaveLength(1);
      const channelResult = result[0];
      expect(channelResult?.members).toHaveLength(3);

      // Check roles are correct
      const owner = channelResult?.members.find((m) => m.userId === ownerId);
      const admin = channelResult?.members.find((m) => m.userId === adminId);
      const member = channelResult?.members.find((m) => m.userId === memberId);

      expect(owner?.role).toBe("owner");
      expect(admin?.role).toBe("admin");
      expect(member?.role).toBe("member");

      // Check all have joinedAt dates
      channelResult?.members.forEach((m) => {
        expect(m.joinedAt).toBeDefined();
        expect(m.joinedAt).toBeInstanceOf(Date);
        expect(m.isActive).toBe(true);
      });
    });

    it("should include inactive members for channels where user is admin/owner", async () => {
      const db = prismaClientWithModels(prisma);
      const testWorkspace = await createTestWorkspace(db, "admin-access-test");
      const userId = randomUUID();

      // Create two channels - userId is owner of channel1, regular member of channel2
      const channel1 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "admin-channel",
        { type: "public", createdBy: userId }
      );

      const channel2Creator = randomUUID();
      const channel2 = await createTestChannel(
        channelRepository,
        testWorkspace.id,
        "member-channel",
        { type: "public", createdBy: channel2Creator }
      );

      // Add userId as member to channel2
      await channelRepository.addOrReactivateMember(
        channel2.id,
        userId,
        channel2Creator,
        "member"
      );

      // Add inactive members to both channels
      const inactiveMember1 = randomUUID();
      const inactiveMembership1 = await channelRepository.addOrReactivateMember(
        channel1.id,
        inactiveMember1,
        userId,
        "member"
      );

      const inactiveMember2 = randomUUID();
      const inactiveMembership2 = await channelRepository.addOrReactivateMember(
        channel2.id,
        inactiveMember2,
        channel2Creator,
        "member"
      );

      // Deactivate both members
      await db.channelMember.update({
        where: { id: inactiveMembership1.id },
        data: { isActive: false },
      });

      await db.channelMember.update({
        where: { id: inactiveMembership2.id },
        data: { isActive: false },
      });

      // Call with admin access for channel1 only
      const result = await channelRepository.getChannelMembersByWorkspace(
        testWorkspace.id,
        userId,
        [channel1.id] // userId has admin access to channel1
      );

      expect(result).toHaveLength(2);

      // Channel 1 - user is owner, should see inactive member
      const channel1Result = result.find((c) => c.channelId === channel1.id);
      expect(channel1Result?.members).toHaveLength(2); // userId (owner) + inactive member
      const channel1UserIds = channel1Result?.members.map((m) => m.userId);
      expect(channel1UserIds).toContain(userId);
      expect(channel1UserIds).toContain(inactiveMember1);

      const inactiveMem1 = channel1Result?.members.find(
        (m) => m.userId === inactiveMember1
      );
      expect(inactiveMem1?.isActive).toBe(false);

      // Channel 2 - user is regular member, should NOT see inactive member
      const channel2Result = result.find((c) => c.channelId === channel2.id);
      expect(channel2Result?.members).toHaveLength(2); // channel2Creator (owner) + userId (member)
      const channel2UserIds = channel2Result?.members.map((m) => m.userId);
      expect(channel2UserIds).not.toContain(inactiveMember2);

      // All returned members in channel2 should be active
      channel2Result?.members.forEach((m) => {
        expect(m.isActive).toBe(true);
      });
    });
  });
});
