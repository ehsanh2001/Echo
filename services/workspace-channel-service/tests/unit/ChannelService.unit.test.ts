import "reflect-metadata";
import { ChannelService } from "../../src/services/ChannelService";
import { IChannelRepository } from "../../src/interfaces/repositories/IChannelRepository";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { PrismaClient } from "@prisma/client";
import { WorkspaceChannelServiceError } from "../../src/utils/errors";
import { ChannelType, WorkspaceRole, ChannelRole } from "../../src/types";

describe("ChannelService - Unit Tests", () => {
  let channelService: ChannelService;
  let mockChannelRepository: jest.Mocked<IChannelRepository>;
  let mockWorkspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Create mocks
    mockChannelRepository = {
      create: jest.fn(),
      createInTransaction: jest.fn(),
      findPublicChannelsByWorkspace: jest.fn(),
      addOrReactivateMember: jest.fn(),
      addMembers: jest.fn(),
      findByNameInWorkspace: jest.fn(),
    } as any;

    mockWorkspaceRepository = {
      create: jest.fn(),
      addMember: jest.fn(),
      findByName: jest.fn(),
      findById: jest.fn(),
      getMembership: jest.fn(),
      countActiveMembers: jest.fn(),
      addOrReactivateMember: jest.fn(),
    } as any;

    mockPrisma = {
      $transaction: jest.fn(),
      channelMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    } as any;

    // Instantiate service with mocks
    channelService = new ChannelService(
      mockChannelRepository,
      mockWorkspaceRepository,
      mockPrisma
    );
  });

  describe("createChannel", () => {
    const workspaceId = "workspace-123";
    const userId = "user-123";

    describe("validation", () => {
      it("should reject public channel without name", async () => {
        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.public,
            name: "",
          })
        ).rejects.toThrow("Channel name is required for public channels");
      });

      it("should reject private channel without name", async () => {
        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.private,
            name: "  ",
          })
        ).rejects.toThrow("Channel name is required for private channels");
      });

      it("should reject direct channel without participants", async () => {
        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.direct,
          })
        ).rejects.toThrow("Participants are required for direct channels");
      });

      it("should reject direct channel with multiple participants", async () => {
        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.direct,
            participants: ["user-456", "user-789"],
          })
        ).rejects.toThrow("Direct channels must have exactly 1 participant");
      });

      it("should reject group_dm without participants", async () => {
        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.group_dm,
            participants: [],
          })
        ).rejects.toThrow("Participants are required for group_dm channels");
      });

      it("should reject group_dm with only 1 participant", async () => {
        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.group_dm,
            participants: ["user-456"],
          })
        ).rejects.toThrow("Group DM channels must have at least 2 other participants");
      });
    });

    describe("authorization", () => {
      it("should reject non-member trying to create channel", async () => {
        mockWorkspaceRepository.getMembership.mockResolvedValue(null);

        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.public,
            name: "test-channel",
          })
        ).rejects.toThrow("User is not a member of this workspace");
      });

      it("should reject inactive member trying to create channel", async () => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.member,
          isActive: false,
        } as any);

        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.public,
            name: "test-channel",
          })
        ).rejects.toThrow("User is not a member of this workspace");
      });

      it("should reject member trying to create public channel", async () => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.member,
          isActive: true,
        } as any);

        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.public,
            name: "test-channel",
          })
        ).rejects.toThrow("Only workspace owners and admins can create public channels");
      });

      it("should reject member trying to create private channel", async () => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.member,
          isActive: true,
        } as any);

        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.private,
            name: "test-channel",
          })
        ).rejects.toThrow("Only workspace owners and admins can create private channels");
      });

      it("should allow admin to create public channel", async () => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.admin,
          isActive: true,
        } as any);
        mockChannelRepository.findByNameInWorkspace.mockResolvedValue(null);
        
        const mockChannel = {
          id: "channel-123",
          name: "test-channel",
          type: ChannelType.public,
          workspaceId,
          createdBy: userId,
          memberCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          displayName: null,
          description: null,
        };

        mockChannelRepository.create.mockResolvedValue(mockChannel as any);
        
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            channelMember: {
              findMany: jest.fn().mockResolvedValue([
                { userId, role: ChannelRole.owner },
              ]),
            },
          };
          return callback(mockTx);
        });

        const result = await channelService.createChannel(workspaceId, userId, {
          type: ChannelType.public,
          name: "test-channel",
        });

        expect(mockChannelRepository.create).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it("should allow member to create direct channel", async () => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.member,
          isActive: true,
        } as any);
        
        const mockChannel = {
          id: "channel-123",
          name: "dm-user-123-user-456",
          type: ChannelType.direct,
          workspaceId,
          createdBy: userId,
          memberCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          displayName: null,
          description: null,
        };

        mockChannelRepository.create.mockResolvedValue(mockChannel as any);
        
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            channelMember: {
              findMany: jest.fn().mockResolvedValue([
                { userId, role: ChannelRole.owner },
              ]),
            },
          };
          return callback(mockTx);
        });

        const result = await channelService.createChannel(workspaceId, userId, {
          type: ChannelType.direct,
          participants: ["user-456"],
        });

        expect(mockChannelRepository.create).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });

    describe("duplicate name checking", () => {
      beforeEach(() => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.owner,
          isActive: true,
        } as any);
      });

      it("should reject duplicate channel name", async () => {
        mockChannelRepository.findByNameInWorkspace.mockResolvedValue({
          id: "existing-channel",
          name: "test-channel",
        } as any);

        await expect(
          channelService.createChannel(workspaceId, userId, {
            type: ChannelType.public,
            name: "test-channel",
          })
        ).rejects.toThrow("Channel name 'test-channel' already exists");
      });

      it("should allow creation if name is unique", async () => {
        mockChannelRepository.findByNameInWorkspace.mockResolvedValue(null);
        
        const mockChannel = {
          id: "channel-123",
          name: "test-channel",
          type: ChannelType.public,
          workspaceId,
          createdBy: userId,
          memberCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          displayName: null,
          description: null,
        };

        mockChannelRepository.create.mockResolvedValue(mockChannel as any);
        
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            channelMember: {
              findMany: jest.fn().mockResolvedValue([
                { userId, role: ChannelRole.owner },
              ]),
            },
          };
          return callback(mockTx);
        });

        const result = await channelService.createChannel(workspaceId, userId, {
          type: ChannelType.public,
          name: "test-channel",
        });

        expect(result).toBeDefined();
        expect(mockChannelRepository.create).toHaveBeenCalled();
      });
    });

    describe("direct channel name generation", () => {
      beforeEach(() => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.member,
          isActive: true,
        } as any);
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            channelMember: { findMany: jest.fn().mockResolvedValue([]) },
          });
        });
      });

      it("should generate consistent name for direct channels (alphabetically sorted)", async () => {
        const mockChannel = {
          id: "channel-123",
          name: "dm-user-123-user-456",
          type: ChannelType.direct,
          workspaceId,
          createdBy: userId,
          memberCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
          displayName: null,
          description: null,
        };

        mockChannelRepository.create.mockResolvedValue(mockChannel as any);
        
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            channelMember: {
              findMany: jest.fn().mockResolvedValue([
                { userId, role: ChannelRole.owner },
              ]),
            },
          };
          return callback(mockTx);
        });

        await channelService.createChannel(workspaceId, userId, {
          type: ChannelType.direct,
          participants: ["user-456"],
        });

        expect(mockChannelRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: expect.stringMatching(/^dm-/),
          }),
          userId,
          expect.anything()
        );
      });
    });

    describe("successful channel creation", () => {
      beforeEach(() => {
        mockWorkspaceRepository.getMembership.mockResolvedValue({
          workspaceId,
          userId,
          role: WorkspaceRole.owner,
          isActive: true,
        } as any);
        mockChannelRepository.findByNameInWorkspace.mockResolvedValue(null);
      });

      it("should create public channel successfully", async () => {
        const mockChannel = {
          id: "channel-123",
          workspaceId,
          name: "test-channel",
          displayName: "Test Channel",
          description: "Test description",
          type: ChannelType.public,
          createdBy: userId,
          isArchived: false,
          memberCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            channelMember: {
              findMany: jest.fn().mockResolvedValue([
                {
                  userId,
                  role: ChannelRole.owner,
                  channelId: "channel-123",
                  joinedAt: new Date(),
                },
              ]),
            },
          };
          return callback(mockTx);
        });

        mockChannelRepository.create.mockResolvedValue(mockChannel as any);

        const result = await channelService.createChannel(workspaceId, userId, {
          type: ChannelType.public,
          name: "test-channel",
          displayName: "Test Channel",
          description: "Test description",
        });

        expect(result).toBeDefined();
        expect(result.id).toBe("channel-123");
        expect(result.name).toBe("test-channel");
        expect(result.type).toBe(ChannelType.public);
        expect(result.members).toHaveLength(1);
        expect(result.members.length).toBeGreaterThan(0);
        expect(result.members[0]!.userId).toBe(userId);
        expect(result.members[0]!.role).toBe(ChannelRole.owner);
      });

      it("should create direct channel with participants", async () => {
        const mockChannel = {
          id: "channel-123",
          workspaceId,
          name: "dm-user-123-user-456",
          displayName: null,
          description: null,
          type: ChannelType.direct,
          createdBy: userId,
          isArchived: false,
          memberCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            channelMember: {
              findMany: jest.fn().mockResolvedValue([
                { userId, role: ChannelRole.owner },
                { userId: "user-456", role: ChannelRole.member },
              ]),
            },
          };
          return callback(mockTx);
        });

        mockChannelRepository.create.mockResolvedValue(mockChannel as any);
        mockChannelRepository.addMembers.mockResolvedValue([
          { userId: "user-456", role: ChannelRole.member } as any,
        ]);

        const result = await channelService.createChannel(workspaceId, userId, {
          type: ChannelType.direct,
          participants: ["user-456"],
        });

        expect(result).toBeDefined();
        expect(result.type).toBe(ChannelType.direct);
        expect(result.members).toHaveLength(2);
        expect(mockChannelRepository.addMembers).toHaveBeenCalledWith(
          "channel-123",
          [{ userId: "user-456", role: ChannelRole.member, joinedBy: userId }],
          expect.anything()
        );
      });
    });
  });
});
