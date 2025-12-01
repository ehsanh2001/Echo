import request from "supertest";
import {
  waitForEmail,
  extractInviteToken,
  getEmailSubject,
  getEmailBody,
  deleteAllEmails,
} from "./helpers/mailhog";

/**
 * End-to-End API Test: Complete Workspace Invite Workflow
 *
 * This test validates the full invite journey:
 * 1. User1 registers and logs in
 * 2. User1 creates a workspace
 * 3. User1 sends an invite to User2's email
 * 4. User2 receives the invite email via MailHog
 * 5. User2 registers with the invited email
 * 6. User2 accepts the invite
 * 7. User2 verifies membership in workspace and channels
 * 8. User2 sends messages to all channels they're a member of
 *
 * All services must be running via docker-compose for this test to pass.
 * MailHog must be running and accessible at http://localhost:8025
 */

describe("E2E: Complete Workspace Invite Workflow", () => {
  // Service base URLs from environment variables
  const USER_SERVICE_URL =
    process.env.USER_SERVICE_URL || "http://localhost:8001";
  const WORKSPACE_CHANNEL_SERVICE_URL =
    process.env.WORKSPACE_CHANNEL_SERVICE_URL || "http://localhost:8002";
  const MESSAGE_SERVICE_URL =
    process.env.MESSAGE_SERVICE_URL || "http://localhost:8003";

  // Test data with timestamps to avoid conflicts
  const timestamp = Date.now();

  // User1 - Workspace creator and inviter
  const user1 = {
    email: `e2e.inviter.${timestamp}@example.com`,
    password: "SecureP@ssw0rd123",
    username: `e2e_inviter_${timestamp}`,
    displayName: `E2E Inviter ${timestamp}`,
  };

  // User2 - Invited user (not yet registered at invite time)
  const user2 = {
    email: `e2e.invited.${timestamp}@example.com`,
    password: "SecureP@ssw0rd456",
    username: `e2e_invited_${timestamp}`,
    displayName: `E2E Invited User ${timestamp}`,
  };

  const testWorkspace = {
    name: `e2e-invite-ws-${timestamp}`,
    displayName: `E2E Invite Test Workspace ${timestamp}`,
    description: "Workspace created for invite E2E testing",
  };

  // Variables to store values across test steps
  let user1AccessToken: string;
  let user1Id: string;
  let user2AccessToken: string;
  let user2Id: string;
  let workspaceId: string;
  let inviteToken: string;
  let channelIds: string[] = [];

  /**
   * Setup: Clear MailHog before test
   */
  beforeAll(async () => {
    await deleteAllEmails();
    console.log("🧹 Cleared MailHog inbox before test");
  });

  /**
   * Step 1: User1 Registers
   */
  it("should successfully register user1 (inviter)", async () => {
    const response = await request(USER_SERVICE_URL)
      .post("/api/users/auth/register")
      .send(user1)
      .expect(201);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("email", user1.email);

    user1Id = response.body.data.id;

    console.log(`✅ Step 1: User1 registered with ID: ${user1Id}`);
  });

  /**
   * Step 2: User1 Logs In
   */
  it("should successfully log in user1", async () => {
    const response = await request(USER_SERVICE_URL)
      .post("/api/users/auth/login")
      .send({
        identifier: user1.email,
        password: user1.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("access_token");

    user1AccessToken = response.body.data.access_token;

    console.log(`✅ Step 2: User1 logged in successfully`);
  });

  /**
   * Step 3: User1 Creates Workspace
   */
  it("should successfully create a workspace", async () => {
    const response = await request(WORKSPACE_CHANNEL_SERVICE_URL)
      .post("/api/ws-ch/workspaces")
      .set("Authorization", `Bearer ${user1AccessToken}`)
      .send(testWorkspace)
      .expect(201);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("name", testWorkspace.name);
    expect(response.body.data).toHaveProperty("ownerId", user1Id);

    workspaceId = response.body.data.id;

    console.log(`✅ Step 3: Workspace created with ID: ${workspaceId}`);
  });

  /**
   * Step 4: User1 Sends Invite to User2
   */
  it("should successfully create workspace invite for user2", async () => {
    const response = await request(WORKSPACE_CHANNEL_SERVICE_URL)
      .post(`/api/ws-ch/workspaces/${workspaceId}/invites`)
      .set("Authorization", `Bearer ${user1AccessToken}`)
      .send({
        email: user2.email,
        role: "member",
        expiresInDays: 7,
        customMessage: "Welcome to our E2E test workspace!",
      })
      .expect(201);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("inviteId");
    expect(response.body.data).toHaveProperty("email", user2.email);
    expect(response.body.data).toHaveProperty("workspaceId", workspaceId);
    expect(response.body.data).toHaveProperty("role", "member");
    expect(response.body.data).toHaveProperty("inviteUrl");

    // Extract token from invite URL for backup (in case email fails)
    const inviteUrl = response.body.data.inviteUrl;
    const tokenFromUrl = extractInviteToken(inviteUrl);
    if (tokenFromUrl) {
      inviteToken = tokenFromUrl;
    }

    console.log(`✅ Step 4: Invite created for ${user2.email}`);
    console.log(`   Invite URL: ${inviteUrl}`);
  }, 10000);

  /**
   * Step 5: User2 Receives Invite Email
   */
  it("should receive invite email in MailHog", async () => {
    console.log(`⏳ Step 5: Waiting for invite email to ${user2.email}...`);

    const email = await waitForEmail(user2.email, 30000);

    expect(email).not.toBeNull();
    expect(email).toBeDefined();

    if (!email) {
      throw new Error("Email not received");
    }

    // Verify email subject
    const subject = getEmailSubject(email);
    expect(subject).toContain("invited");
    expect(subject.toLowerCase()).toMatch(/workspace|invitation/);

    // Extract invite token from email body
    const body = getEmailBody(email);
    const extractedToken = extractInviteToken(body);

    expect(extractedToken).not.toBeNull();
    expect(extractedToken).toBeDefined();

    if (!extractedToken) {
      throw new Error("Could not extract invite token from email");
    }

    inviteToken = extractedToken;

    console.log(`✅ Step 5: Email received with token: ${inviteToken}`);
    console.log(`   Subject: "${subject}"`);
  }, 35000);

  /**
   * Step 6: User2 Registers
   */
  it("should successfully register user2 (invited user)", async () => {
    const response = await request(USER_SERVICE_URL)
      .post("/api/users/auth/register")
      .send(user2)
      .expect(201);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("email", user2.email);

    user2Id = response.body.data.id;

    console.log(`✅ Step 6: User2 registered with ID: ${user2Id}`);
  });

  /**
   * Step 7: User2 Logs In
   */
  it("should successfully log in user2", async () => {
    const response = await request(USER_SERVICE_URL)
      .post("/api/users/auth/login")
      .send({
        identifier: user2.email,
        password: user2.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("access_token");

    user2AccessToken = response.body.data.access_token;

    console.log(`✅ Step 7: User2 logged in successfully`);
  });

  /**
   * Step 8: User2 Accepts Invite
   */
  it("should successfully accept workspace invite", async () => {
    const response = await request(WORKSPACE_CHANNEL_SERVICE_URL)
      .post("/api/ws-ch/workspaces/invites/accept")
      .set("Authorization", `Bearer ${user2AccessToken}`)
      .send({
        token: inviteToken,
      })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("workspace");
    expect(response.body.data).toHaveProperty("channels");

    // Validate workspace details
    const workspace = response.body.data.workspace;
    expect(workspace).toHaveProperty("id", workspaceId);
    expect(workspace).toHaveProperty("name", testWorkspace.name);

    // Validate channels array (should have at least 'general' channel)
    const channels = response.body.data.channels;
    expect(Array.isArray(channels)).toBe(true);
    expect(channels.length).toBeGreaterThan(0);

    // Store channel IDs for message testing
    channelIds = channels.map((ch: any) => ch.id);

    console.log(`✅ Step 8: User2 accepted invite to workspace ${workspaceId}`);
    console.log(`   User2 added to ${channels.length} channel(s)`);
    console.log(
      `   Channels: ${channels.map((ch: any) => ch.name).join(", ")}`
    );
  });

  /**
   * Step 9: Verify User2 Workspace Membership
   */
  it("should verify user2 is a member of the workspace", async () => {
    const response = await request(WORKSPACE_CHANNEL_SERVICE_URL)
      .get(`/api/ws-ch/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${user2AccessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body.data).toHaveProperty("id", workspaceId);
    expect(response.body.data).toHaveProperty("userRole", "member");

    console.log(`✅ Step 9: User2 confirmed as member of workspace`);
    console.log(`   Role: ${response.body.data.userRole}`);
  });

  /**
   * Step 10: User2 Sends Messages to All Channels
   */
  it("should successfully send messages to all channels user2 is member of", async () => {
    expect(channelIds.length).toBeGreaterThan(0);

    for (const channelId of channelIds) {
      const messageContent = `E2E test message from User2 to channel ${channelId}`;

      const response = await request(MESSAGE_SERVICE_URL)
        .post(
          `/api/messages/workspaces/${workspaceId}/channels/${channelId}/messages`
        )
        .set("Authorization", `Bearer ${user2AccessToken}`)
        .send({
          content: messageContent,
        })
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("content", messageContent);
      expect(response.body.data).toHaveProperty("userId", user2Id);
      expect(response.body.data).toHaveProperty("channelId", channelId);
      expect(response.body.data).toHaveProperty("workspaceId", workspaceId);

      console.log(
        `   ✅ Message sent to channel ${channelId}: "${messageContent}"`
      );
    }

    console.log(
      `✅ Step 10: User2 sent messages to all ${channelIds.length} channel(s)`
    );
  });

  /**
   * Cleanup: Summary
   */
  afterAll(() => {
    console.log("\n" + "=".repeat(80));
    console.log("🎉 E2E Invite Workflow Test Completed Successfully!");
    console.log("=".repeat(80));
    console.log("Test Data Created:");
    console.log(`  👤 User1 (Inviter) ID:    ${user1Id}`);
    console.log(`  👤 User1 Email:           ${user1.email}`);
    console.log(`  👤 User2 (Invited) ID:    ${user2Id}`);
    console.log(`  👤 User2 Email:           ${user2.email}`);
    console.log(`  🏢 Workspace ID:          ${workspaceId}`);
    console.log(`  🔑 Invite Token:          ${inviteToken}`);
    console.log(
      `  📺 Channels (${channelIds.length}):         ${channelIds.join(", ")}`
    );
    console.log("=".repeat(80));
    console.log("✅ Workspace invite flow validated:");
    console.log("   - User1 creates workspace and sends invite");
    console.log("   - User2 receives email notification");
    console.log("   - User2 registers and accepts invite");
    console.log("   - User2 verified as workspace member");
    console.log("   - User2 can send messages to workspace channels");
    console.log("=".repeat(80));
    console.log("Note: Run cleanup.sql to remove test data from databases");
    console.log("=".repeat(80) + "\n");
  });
});
