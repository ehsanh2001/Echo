import request from "supertest";

/**
 * End-to-End API Test: Complete Message Creation Workflow
 *
 * This test validates the full user journey:
 * 1. User signup (user-service)
 * 2. User login (user-service)
 * 3. Create workspace (workspace-channel-service)
 * 4. Create public channel (workspace-channel-service)
 * 5. Send message to channel (message-service)
 *
 * All services must be running via docker-compose for this test to pass.
 */

describe("E2E: Complete Message Creation Workflow", () => {
  // Service base URLs from environment variables
  const USER_SERVICE_URL =
    process.env.USER_SERVICE_URL || "http://localhost:8001";
  const WORKSPACE_CHANNEL_SERVICE_URL =
    process.env.WORKSPACE_CHANNEL_SERVICE_URL || "http://localhost:8002";
  const MESSAGE_SERVICE_URL =
    process.env.MESSAGE_SERVICE_URL || "http://localhost:8003";

  // Test data
  const testUser = {
    email: "e2e.test@example.com",
    password: "SecureP@ssw0rd123",
    username: "e2e_test_user",
    displayName: "E2E Test User",
  };

  const testWorkspace = {
    name: "e2e-test-workspace",
    displayName: "E2E Test Workspace",
    description: "Workspace created during E2E testing",
  };

  const testChannel = {
    type: "public",
    name: "e2e-test-channel",
    displayName: "E2E Test Channel",
    description: "Channel created during E2E testing",
  };

  const testMessage = {
    content: "Hello! This is an E2E test message.",
  };

  // Variables to store values across test steps
  let accessToken: string;
  let userId: string;
  let workspaceId: string;
  let channelId: string;
  let messageId: string;

  /**
   * Step 1: User Signup
   */
  it("should successfully sign up a new user", async () => {
    const response = await request(USER_SERVICE_URL)
      .post("/api/users/auth/register")
      .send(testUser)
      .expect(201);

    // Validate response structure
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty(
      "message",
      "User registered successfully"
    );
    expect(response.body).toHaveProperty("data");

    // Validate user data (register returns UserProfile only, no tokens)
    const user = response.body.data;
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("email", testUser.email);
    expect(user).toHaveProperty("username", testUser.username);
    expect(user).toHaveProperty("displayName", testUser.displayName);
    expect(user).toHaveProperty("createdAt");
    expect(user).toHaveProperty("roles");
    expect(Array.isArray(user.roles)).toBe(true);
    expect(user).not.toHaveProperty("passwordHash"); // Should not expose password hash

    // Store user ID for later steps
    userId = user.id;

    console.log(`✅ Step 1: User signed up successfully with ID: ${userId}`);
  });

  /**
   * Step 2: User Login
   */
  it("should successfully log in with credentials", async () => {
    const response = await request(USER_SERVICE_URL)
      .post("/api/users/auth/login")
      .send({
        identifier: testUser.email, // Login uses "identifier" not "email"
        password: testUser.password,
      })
      .expect(200);

    // Validate response structure
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("message", "Login successful");
    expect(response.body).toHaveProperty("data");

    // Login response has access_token, refresh_token, expires_in, user
    const { data } = response.body;
    expect(data).toHaveProperty("access_token");
    expect(data).toHaveProperty("refresh_token");
    expect(data).toHaveProperty("expires_in");
    expect(data).toHaveProperty("user");

    // Validate tokens are JWT format (3 parts separated by dots)
    expect(data.access_token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(data.refresh_token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

    // Validate user object
    expect(data.user).toHaveProperty("id", userId);
    expect(data.user).toHaveProperty("email", testUser.email);

    // Store access token for authenticated requests
    accessToken = data.access_token;

    console.log(
      `✅ Step 2: User logged in successfully, access token obtained`
    );
  });

  /**
   * Step 3: Create Workspace
   */
  it("should successfully create a workspace", async () => {
    const response = await request(WORKSPACE_CHANNEL_SERVICE_URL)
      .post("/api/ws-ch/workspaces")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(testWorkspace)
      .expect(201);

    // Validate response structure
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty(
      "message",
      "Workspace created successfully"
    );

    // Validate workspace data
    const { data: workspace } = response.body;
    expect(workspace).toHaveProperty("id");
    expect(workspace).toHaveProperty("name", testWorkspace.name);
    expect(workspace).toHaveProperty("displayName", testWorkspace.displayName);
    expect(workspace).toHaveProperty("description", testWorkspace.description);
    expect(workspace).toHaveProperty("ownerId", userId);
    expect(workspace).toHaveProperty("isArchived", false);
    expect(workspace).toHaveProperty("createdAt");
    expect(workspace).toHaveProperty("updatedAt");

    // Validate UUID format for workspace ID
    expect(workspace.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Store workspace ID for next steps
    workspaceId = workspace.id;

    console.log(
      `✅ Step 3: Workspace created successfully with ID: ${workspaceId}`
    );
  });

  /**
   * Step 4: Create Public Channel
   */
  it("should successfully create a public channel in the workspace", async () => {
    const response = await request(WORKSPACE_CHANNEL_SERVICE_URL)
      .post(`/api/ws-ch/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(testChannel)
      .expect(201);

    // Validate response structure
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty(
      "message",
      "Channel created successfully"
    );

    // Validate channel data
    const { data: channel } = response.body;
    expect(channel).toHaveProperty("id");
    expect(channel).toHaveProperty("workspaceId", workspaceId);
    expect(channel).toHaveProperty("name", testChannel.name);
    expect(channel).toHaveProperty("displayName", testChannel.displayName);
    expect(channel).toHaveProperty("description", testChannel.description);
    expect(channel).toHaveProperty("type", testChannel.type);
    expect(channel).toHaveProperty("createdBy", userId);
    expect(channel).toHaveProperty("memberCount", 1); // Creator is automatically a member
    expect(channel).toHaveProperty("isArchived", false);
    expect(channel).toHaveProperty("isReadOnly", false);
    expect(channel).toHaveProperty("createdAt");
    expect(channel).toHaveProperty("updatedAt");

    // Validate UUID format for channel ID
    expect(channel.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Validate members array
    expect(channel).toHaveProperty("members");
    expect(Array.isArray(channel.members)).toBe(true);
    expect(channel.members.length).toBe(1);
    expect(channel.members[0]).toHaveProperty("userId", userId);
    expect(channel.members[0]).toHaveProperty("role", "owner");

    // Store channel ID for next step
    channelId = channel.id;

    console.log(
      `✅ Step 4: Channel created successfully with ID: ${channelId}`
    );
  });

  /**
   * Step 5: Send Message to Channel
   */
  it("should successfully send a message to the channel", async () => {
    const response = await request(MESSAGE_SERVICE_URL)
      .post(
        `/api/messages/workspaces/${workspaceId}/channels/${channelId}/messages`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send(testMessage)
      .expect(201);

    // Validate response structure
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("data");

    // Validate message data
    const { data: message } = response.body;
    expect(message).toHaveProperty("id");
    expect(message).toHaveProperty("workspaceId", workspaceId);
    expect(message).toHaveProperty("channelId", channelId);
    expect(message).toHaveProperty("userId", userId);
    expect(message).toHaveProperty("content", testMessage.content);
    expect(message).toHaveProperty("contentType", "text");
    expect(message).toHaveProperty("messageNo"); // Sequential message number
    expect(message).toHaveProperty("isEdited", false);
    expect(message).toHaveProperty("editCount", 0);
    expect(message).toHaveProperty("createdAt");
    expect(message).toHaveProperty("updatedAt");

    // Validate UUID format for message ID
    expect(message.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Validate author information (enriched by message service)
    expect(message).toHaveProperty("author");
    expect(message.author).toHaveProperty("id", userId);
    expect(message.author).toHaveProperty("username", testUser.username);
    expect(message.author).toHaveProperty("displayName", testUser.displayName);
    expect(message.author).toHaveProperty("avatarUrl");

    // Validate threading fields
    expect(message).toHaveProperty("parentMessageId", null);
    expect(message).toHaveProperty("threadRootId", null);
    expect(message).toHaveProperty("threadDepth", 0);

    // Validate message number is sequential (should be 1 for first message)
    expect(message.messageNo).toBe(1); // messageNo is a number, not string

    // Store message ID
    messageId = message.id;

    console.log(`✅ Step 5: Message sent successfully with ID: ${messageId}`);
  });

  /**
   * Summary: Print test results
   */
  afterAll(() => {
    console.log("\n" + "=".repeat(80));
    console.log("🎉 E2E Test Completed Successfully!");
    console.log("=".repeat(80));
    console.log("Test Data Created:");
    console.log(`  👤 User ID:       ${userId}`);
    console.log(`  🏢 Workspace ID:  ${workspaceId}`);
    console.log(`  📺 Channel ID:    ${channelId}`);
    console.log(`  💬 Message ID:    ${messageId}`);
    console.log("=".repeat(80));
    console.log("Note: Run cleanup.sql to remove test data from databases");
    console.log("=".repeat(80) + "\n");
  });
});
