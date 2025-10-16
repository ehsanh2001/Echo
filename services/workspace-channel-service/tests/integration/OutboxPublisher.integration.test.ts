import "reflect-metadata";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { container } from "../../src/container";
import { IOutboxRepository } from "../../src/interfaces/repositories/IOutboxRepository";
import { IWorkspaceRepository } from "../../src/interfaces/repositories/IWorkspaceRepository";
import { IOutboxPublisher } from "../../src/interfaces/workers/IOutboxPublisher";
import { IRabbitMQService } from "../../src/interfaces/services/IRabbitMQService";
import { CreateOutboxEventData } from "../../src/types";
import { PrismaClient, OutboxEvent } from "@prisma/client";
import { randomUUID } from "crypto";
import amqp from "amqplib";
import { config } from "../../src/config/env";

const TEST_PREFIX = "outbox-publisher-integration";
const TEST_QUEUE = `${TEST_PREFIX}-test-queue`;

/**
 * Test timeout configuration
 *
 * Calculated based on worker configuration to ensure tests remain valid
 * if poll interval changes. Uses 2x the poll interval to account for:
 * - Initial poll delay (worker polls every config.worker.pollIntervalMs)
 * - Processing time for the batch
 * - RabbitMQ message delivery latency
 * - Additional 3s buffer for test execution overhead
 *
 * Example: If pollIntervalMs = 5000ms, timeout = 13000ms (10s + 3s buffer)
 */
const TEST_TIMEOUT = config.worker.pollIntervalMs * 2 + 3000;

/**
 * Integration Tests for OutboxPublisher
 *
 * Tests the complete flow:
 * 1. Create outbox events in database
 * 2. OutboxPublisher polls and publishes to RabbitMQ
 * 3. Verify events are received in RabbitMQ
 * 4. Verify events are marked as published in database
 *
 * Prerequisites:
 * - RabbitMQ must be running
 * - Test database must be configured
 */
describe("OutboxPublisher Integration Tests", () => {
  let outboxPublisher: IOutboxPublisher;
  let outboxRepository: IOutboxRepository;
  let workspaceRepository: IWorkspaceRepository;
  let rabbitMQService: IRabbitMQService;
  let prisma: PrismaClient;

  // RabbitMQ test consumer
  let rabbitConnection: amqp.ChannelModel;
  let rabbitChannel: amqp.Channel;
  let receivedMessages: any[] = [];

  // Test data cleanup tracking
  const createdEventIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    // Setup RabbitMQ test consumer
    try {
      // Use the same URL from config, which includes credentials
      // Format: amqp://user:password@host:port
      const rabbitUrl = config.rabbitmq.url;

      rabbitConnection = await amqp.connect(rabbitUrl);
      rabbitChannel = await rabbitConnection.createChannel();

      // Declare the exchange (same as the service uses)
      await rabbitChannel.assertExchange(config.rabbitmq.exchange, "topic", {
        durable: true,
      });

      // Declare test queue bound to the exchange
      await rabbitChannel.assertQueue(TEST_QUEUE, {
        durable: false,
        autoDelete: true,
      });

      // Bind queue to exchange with wildcard routing key
      await rabbitChannel.bindQueue(
        TEST_QUEUE,
        config.rabbitmq.exchange,
        "workspace.#" // Catch all workspace events
      );

      // Start consuming messages
      await rabbitChannel.consume(
        TEST_QUEUE,
        (msg) => {
          if (msg) {
            const content = JSON.parse(msg.content.toString());
            receivedMessages.push(content);
            rabbitChannel.ack(msg);
          }
        },
        { noAck: false, consumerTag: "test-consumer" }
      );

      console.log(`✅ RabbitMQ test consumer started on queue: ${TEST_QUEUE}`);
    } catch (error) {
      console.error("❌ Failed to setup RabbitMQ test consumer:", error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup RabbitMQ
    try {
      if (rabbitChannel) {
        // Cancel all consumers first
        try {
          await rabbitChannel.cancel("test-consumer");
        } catch (error) {
          // Consumer might not exist
        }

        // Delete test queue
        try {
          await rabbitChannel.deleteQueue(TEST_QUEUE);
        } catch (error) {
          // Queue might already be deleted (auto-delete)
        }

        await rabbitChannel.close();
      }
      if (rabbitConnection) {
        await rabbitConnection.close();
      }
      console.log("✅ RabbitMQ test consumer cleaned up");

      // Give time for cleanup to fully complete
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("❌ Error cleaning up RabbitMQ:", error);
    }
  }, 10000); // 10 second timeout for cleanup

  beforeEach(async () => {
    // Get instances from DI container
    outboxPublisher = container.resolve<IOutboxPublisher>("IOutboxPublisher");
    outboxRepository =
      container.resolve<IOutboxRepository>("IOutboxRepository");
    workspaceRepository = container.resolve<IWorkspaceRepository>(
      "IWorkspaceRepository"
    );
    rabbitMQService = container.resolve<IRabbitMQService>("IRabbitMQService");
    prisma = container.resolve<PrismaClient>(PrismaClient); // Use same instance from container

    // Clear database tables (in correct order due to foreign keys)
    await prisma.outboxEvent.deleteMany();
    await prisma.channelMember.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.workspace.deleteMany();

    // Purge test queue to remove any old messages
    try {
      const purgeResult = await rabbitChannel.purgeQueue(TEST_QUEUE);
      if (purgeResult.messageCount > 0) {
        console.log(
          `🧹 Purged ${purgeResult.messageCount} old messages from queue`
        );
      }
      // Give RabbitMQ a moment to fully process the purge
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Queue might not exist yet, that's ok
      console.log("⚠️  Could not purge queue (might not exist yet)");
    }

    // Clear received messages array
    receivedMessages = [];
  });

  afterEach(async () => {
    // Stop publisher if running
    if (outboxPublisher.isRunning()) {
      await outboxPublisher.stop();
    }

    // Disconnect RabbitMQ service
    if (rabbitMQService.isConnected()) {
      await rabbitMQService.disconnect();
    }

    // Clean up test data
    try {
      // Delete outbox events
      if (createdEventIds.length > 0) {
        await prisma.outboxEvent.deleteMany({
          where: { id: { in: createdEventIds } },
        });
        createdEventIds.length = 0;
      }

      // Delete workspaces
      if (createdWorkspaceIds.length > 0) {
        // Delete channel members first
        await prisma.channelMember.deleteMany({
          where: { channel: { workspaceId: { in: createdWorkspaceIds } } },
        });

        // Delete channels
        await prisma.channel.deleteMany({
          where: { workspaceId: { in: createdWorkspaceIds } },
        });

        // Delete workspace members
        await prisma.workspaceMember.deleteMany({
          where: { workspaceId: { in: createdWorkspaceIds } },
        });

        // Delete workspaces
        await prisma.workspace.deleteMany({
          where: { id: { in: createdWorkspaceIds } },
        });

        createdWorkspaceIds.length = 0;
      }
    } catch (error) {
      console.error("Error cleaning up test data:", error);
    } finally {
      await prisma.$disconnect();
    }
  });

  // Helper: Create test workspace
  const createTestWorkspace = async (ownerId: string) => {
    const workspaceId = randomUUID();
    const workspace = await workspaceRepository.create(
      {
        name: `${TEST_PREFIX}-${workspaceId}`,
        displayName: `Test Workspace ${workspaceId}`,
        ownerId,
      },
      ownerId
    );
    createdWorkspaceIds.push(workspace.id);
    return workspace;
  };

  // Helper: Create test outbox event
  const createTestEvent = async (
    workspaceId: string,
    eventType: string = "workspace.invite.created"
  ) => {
    const eventData: CreateOutboxEventData = {
      workspaceId,
      aggregateType: "workspace",
      aggregateId: workspaceId,
      eventType,
      payload: {
        eventId: randomUUID(),
        eventType,
        aggregateType: "workspace",
        aggregateId: workspaceId,
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: {
          inviteId: randomUUID(),
          workspaceId,
          workspaceName: "test-workspace",
          workspaceDisplayName: "Test Workspace",
          email: "test@example.com",
          role: "member",
          inviterUserId: randomUUID(),
          inviteToken: "test-token",
          inviteUrl: "https://example.com/invite/test-token",
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        metadata: {
          source: "workspace-channel-service",
        },
      },
    };

    const event = await outboxRepository.create(eventData);
    createdEventIds.push(event.id);
    return event;
  };

  // Helper: Wait for messages to be received
  // Note: Worker polls based on config.worker.pollIntervalMs, so we need to wait at least that long
  const waitForMessages = async (
    expectedCount: number,
    timeoutMs: number = config.worker.pollIntervalMs + 2000 // Poll interval + 2s buffer for processing
  ): Promise<any[]> => {
    const startTime = Date.now();
    while (receivedMessages.length < expectedCount) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Timeout waiting for messages. Expected ${expectedCount}, got ${receivedMessages.length}. ` +
            `Received IDs: ${receivedMessages.map((m) => m.eventId).join(", ")}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return receivedMessages;
  };

  describe("End-to-End Event Publishing", () => {
    it(
      "should publish pending events from database to RabbitMQ",
      async () => {
        // Arrange: Create test workspace and events
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);
        const event1 = await createTestEvent(workspace.id);
        const event2 = await createTestEvent(workspace.id);

        // Extract the payload eventIds (not the database IDs)
        const event1Payload = event1.payload as any;
        const event2Payload = event2.payload as any;
        const event1PayloadId = event1Payload.eventId;
        const event2PayloadId = event2Payload.eventId;

        // Act: Start publisher
        await outboxPublisher.start();

        // Wait for events to be published and received
        const messages = await waitForMessages(2);

        // Stop publisher
        await outboxPublisher.stop();

        // Assert: Verify messages received in RabbitMQ
        expect(messages).toHaveLength(2);

        const receivedEventIds = messages.map((m) => m.eventId);
        expect(receivedEventIds).toContain(event1PayloadId);
        expect(receivedEventIds).toContain(event2PayloadId);

        // Assert: Verify message structure
        messages.forEach((msg) => {
          expect(msg).toHaveProperty("eventId");
          expect(msg).toHaveProperty("eventType", "workspace.invite.created");
          expect(msg).toHaveProperty("aggregateType", "workspace");
          expect(msg).toHaveProperty("data");
          expect(msg).toHaveProperty("metadata");
          expect(msg.metadata).toHaveProperty(
            "source",
            "workspace-channel-service"
          );
        });

        // Assert: Verify events marked as published in database
        const publishedEvent1 = await prisma.outboxEvent.findUnique({
          where: { id: event1.id },
        });
        const publishedEvent2 = await prisma.outboxEvent.findUnique({
          where: { id: event2.id },
        });

        expect(publishedEvent1?.status).toBe("published");
        expect(publishedEvent1?.publishedAt).not.toBeNull();
        expect(publishedEvent2?.status).toBe("published");
        expect(publishedEvent2?.publishedAt).not.toBeNull();
      },
      TEST_TIMEOUT
    );

    it("should handle multiple batches of events", async () => {
      // Arrange: Create many events (more than batch size)
      const ownerId = randomUUID();
      const workspace = await createTestWorkspace(ownerId);

      const eventCount = 12; // More than default batch size (5)
      const events: OutboxEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        const event = await createTestEvent(workspace.id);
        events.push(event);
      }

      // Act: Start publisher
      await outboxPublisher.start();

      // Wait for all events to be published
      // (12 events fit in one batch, so one poll cycle should process them all)
      const messages = await waitForMessages(eventCount); // Use default timeout (7s)

      // Stop publisher
      await outboxPublisher.stop();

      // Assert: All events received
      expect(messages).toHaveLength(eventCount);

      // Assert: All events marked as published
      const publishedEvents = await prisma.outboxEvent.findMany({
        where: { id: { in: events.map((e) => e.id) } },
      });

      expect(publishedEvents).toHaveLength(eventCount);
      publishedEvents.forEach((event) => {
        expect(event.status).toBe("published");
        expect(event.publishedAt).not.toBeNull();
      });
    }, 15000);

    it(
      "should use correct routing key for events",
      async () => {
        // Arrange
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);
        await createTestEvent(workspace.id, "workspace.invite.created");

        // Act
        await outboxPublisher.start();
        const messages = await waitForMessages(1);
        await outboxPublisher.stop();

        // Assert: Message eventType should match
        expect(messages[0].eventType).toBe("workspace.invite.created");
      },
      TEST_TIMEOUT
    );
  });

  describe("Error Handling", () => {
    it(
      "should continue processing other events if one is malformed",
      async () => {
        // Arrange: Create valid and invalid events
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);

        const validEvent1 = await createTestEvent(workspace.id);

        // Create malformed event (null payload)
        const malformedEventData: CreateOutboxEventData = {
          workspaceId: workspace.id,
          aggregateType: "workspace",
          aggregateId: workspace.id,
          eventType: "workspace.test.malformed",
          payload: null as any, // Malformed payload
        };
        const malformedEvent = await outboxRepository.create(
          malformedEventData
        );
        createdEventIds.push(malformedEvent.id);

        const validEvent2 = await createTestEvent(workspace.id);

        // Act
        await outboxPublisher.start();

        // Wait for valid events to be published
        // Worker polls based on config, so wait at least one poll cycle + buffer
        await new Promise((resolve) =>
          setTimeout(resolve, config.worker.pollIntervalMs + 1000)
        );

        await outboxPublisher.stop();

        // Assert: Valid events should be published
        const publishedEvent1 = await prisma.outboxEvent.findUnique({
          where: { id: validEvent1.id },
        });
        const publishedEvent2 = await prisma.outboxEvent.findUnique({
          where: { id: validEvent2.id },
        });

        expect(publishedEvent1?.status).toBe("published");
        expect(publishedEvent2?.status).toBe("published");

        // Malformed event: Worker doesn't validate payload structure,
        // so null payload will be sent to RabbitMQ and marked as published
        const malformedEventResult = await prisma.outboxEvent.findUnique({
          where: { id: malformedEvent.id },
        });
        // Worker processes all events regardless of payload validity
        expect(malformedEventResult?.status).toBe("published");
      },
      TEST_TIMEOUT
    );
  });

  describe("Worker Lifecycle", () => {
    it("should start and stop gracefully", async () => {
      expect(outboxPublisher.isRunning()).toBe(false);

      await outboxPublisher.start();
      expect(outboxPublisher.isRunning()).toBe(true);

      await outboxPublisher.stop();
      expect(outboxPublisher.isRunning()).toBe(false);
    });

    it(
      "should not publish events after stopping",
      async () => {
        // Arrange
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);

        // Start and stop immediately
        await outboxPublisher.start();
        await outboxPublisher.stop();

        // Create event after stopping
        await createTestEvent(workspace.id);

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Assert: No messages should be received
        expect(receivedMessages).toHaveLength(0);
      },
      TEST_TIMEOUT
    );
  });

  describe("RabbitMQ Connection", () => {
    it(
      "should establish connection when publishing",
      async () => {
        // Initially not connected
        expect(rabbitMQService.isConnected()).toBe(false);

        // Create event
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);
        await createTestEvent(workspace.id);

        // Start publisher (triggers lazy connection)
        await outboxPublisher.start();

        // Wait for connection and publishing
        await waitForMessages(1);

        // Connection should be established
        expect(rabbitMQService.isConnected()).toBe(true);

        await outboxPublisher.stop();
      },
      TEST_TIMEOUT
    );

    it(
      "should disconnect when worker stops",
      async () => {
        // Start and publish
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);
        await createTestEvent(workspace.id);

        await outboxPublisher.start();
        await waitForMessages(1);

        // Stop worker
        await outboxPublisher.stop();

        // Connection should be closed
        expect(rabbitMQService.isConnected()).toBe(false);
      },
      TEST_TIMEOUT
    );
  });

  describe("Transaction Safety", () => {
    it(
      "should not lose events when single worker processes multiple events",
      async () => {
        // Arrange: Create events
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);
        const event1 = await createTestEvent(workspace.id);
        const event2 = await createTestEvent(workspace.id);
        const event3 = await createTestEvent(workspace.id);

        // Act: Start publisher
        await outboxPublisher.start();

        // Wait for all events
        await waitForMessages(3);

        await outboxPublisher.stop();

        // Assert: Each event published exactly once
        expect(receivedMessages).toHaveLength(3);

        // Verify each event ID appears exactly once
        const eventIds = receivedMessages.map((m) => m.eventId);
        const uniqueEventIds = new Set(eventIds);
        expect(uniqueEventIds.size).toBe(3);
      },
      TEST_TIMEOUT
    );

    it(
      "should not lose or duplicate events with multiple concurrent workers",
      async () => {
        // This test verifies SELECT FOR UPDATE SKIP LOCKED prevents race conditions
        // when multiple workers run simultaneously

        // Arrange: Create 4 events
        const ownerId = randomUUID();
        const workspace = await createTestWorkspace(ownerId);
        const event1 = await createTestEvent(workspace.id);
        const event2 = await createTestEvent(workspace.id);
        const event3 = await createTestEvent(workspace.id);
        const event4 = await createTestEvent(workspace.id);

        // Get payload event IDs to verify later
        const expectedEventIds = [
          (event1.payload as any).eventId,
          (event2.payload as any).eventId,
          (event3.payload as any).eventId,
          (event4.payload as any).eventId,
        ];

        // Act: Create two publishers that will compete for the same events
        const publisher1 =
          container.resolve<IOutboxPublisher>("IOutboxPublisher");
        const publisher2 =
          container.resolve<IOutboxPublisher>("IOutboxPublisher");

        try {
          // Start both publishers simultaneously
          await Promise.all([publisher1.start(), publisher2.start()]);

          // Wait for all 4 events to be processed
          await waitForMessages(4, config.worker.pollIntervalMs * 3 + 3000);
        } finally {
          // Stop both publishers - use finally to ensure cleanup even if test fails
          await Promise.all([publisher1.stop(), publisher2.stop()]);

          // Give a moment for cleanup to complete
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Assert: All 4 events should be published exactly once
        expect(receivedMessages).toHaveLength(4);

        // Verify no duplicates - each event ID appears exactly once
        const receivedEventIds = receivedMessages.map((m) => m.eventId);
        const uniqueEventIds = new Set(receivedEventIds);
        expect(uniqueEventIds.size).toBe(4);

        // Verify all expected events were published
        expectedEventIds.forEach((expectedId) => {
          expect(receivedEventIds).toContain(expectedId);
        });

        // Verify in database: all events should be marked as published
        const dbEvents = await prisma.outboxEvent.findMany({
          where: {
            id: { in: [event1.id, event2.id, event3.id, event4.id] },
          },
        });

        expect(dbEvents).toHaveLength(4);
        dbEvents.forEach((event) => {
          expect(event.status).toBe("published");
          expect(event.publishedAt).not.toBeNull();
        });
      },
      config.worker.pollIntervalMs * 4 + 5000 // Longer timeout for concurrent processing
    );
  });
});
