/**
 * Database seeding script for messages
 * Seeds 400 messages in each of 2 channels for pagination testing
 *
 * Usage:
 *   npx tsx seed/seed-messages.ts
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://10.0.0.155:8004";

// Seeding configuration
const CONFIG = {
  // Option 1: Use existing user credentials
  username: process.env.SEED_USERNAME || "ehsan",
  password: process.env.SEED_PASSWORD || "Password123",

  // Option 2: Workspace and channels (can be overridden by env vars)
  workspaceId:
    process.env.SEED_WORKSPACE_ID || "72e8a070-39dc-4e71-a80e-eaf586fae5d6",
  channels: [
    {
      id: process.env.SEED_CHANNEL_1 || "2e903e6e-7e13-418a-b080-6fd51144e7ec",
      name: "Channel 1",
    },
    {
      id: process.env.SEED_CHANNEL_2 || "f9184dd1-3f9e-459f-9c73-e600d1965ccd",
      name: "Channel 2",
    },
  ],
  messagesPerChannel: parseInt(
    process.env.SEED_MESSAGES_PER_CHANNEL || "400",
    10
  ),
  batchSize: 20, // Send messages in batches to avoid overwhelming the server
  delayBetweenBatches: 500, // ms
};

// Sample message content variations
const MESSAGE_TEMPLATES = [
  "Hey team! 👋",
  "Great work on the last sprint!",
  "Has anyone reviewed the PRs yet?",
  "Meeting starts in 10 minutes",
  "Can someone help me with this bug?",
  "Just deployed to staging 🚀",
  "Coffee break? ☕",
  "The build is passing now ✅",
  "Need a code review when someone has time",
  "Thanks for the help earlier!",
  "Working on the new feature",
  "Found an interesting article about React",
  "Let's discuss this in our standup",
  "Good morning everyone!",
  "Have a great weekend! 🎉",
  "The deployment went smoothly",
  "Anyone free for a quick call?",
  "Just pushed the fix",
  "Updated the documentation",
  "This is looking good!",
  "Can we schedule a sync?",
  "The tests are all green now",
  "I'll take care of that ticket",
  "Perfect timing!",
  "Nice catch on that bug",
  "Let me know if you need anything",
  "On it! 💪",
  "Sounds good to me",
  "I agree with that approach",
  "Let's ship it! 🚢",
];

const EXTENDED_MESSAGES = [
  "I think we should consider refactoring this module. The current implementation is getting a bit complex and hard to maintain.",
  "Quick update: I've finished the initial implementation. It's ready for review whenever you have time.",
  "Just a heads up - I'll be out tomorrow afternoon for a dentist appointment.",
  "Does anyone have experience with this? I'm running into some issues and could use some guidance.",
  "Great point! I hadn't thought about that edge case. Let me update my implementation.",
  "I've created a draft PR for this. Still needs tests, but wanted to get early feedback on the approach.",
  "FYI: The staging environment will be down for maintenance between 2-3 PM today.",
  "This is exactly what we needed! Thanks for taking the initiative on this.",
  "I'm seeing some performance issues with the new feature. Anyone else experiencing this?",
  "After reviewing the requirements again, I think we might need to adjust our approach here.",
];

const TECHNICAL_MESSAGES = [
  "The API is returning a 500 error when I try to fetch the user list. Is this a known issue?",
  "I've optimized the database queries and we're seeing a 40% improvement in response time.",
  "We should add proper error boundaries to prevent the entire app from crashing.",
  "The TypeScript types for this component need to be updated after the recent API changes.",
  "I've added comprehensive unit tests for the new authentication flow.",
  "Memory leak fixed in the message list component. Was caused by missing cleanup in useEffect.",
  "We need to upgrade the dependencies - several have security vulnerabilities.",
  "The CI/CD pipeline is failing on the lint step. I'll fix it shortly.",
  "Added proper loading states and error handling to the form submission.",
  "The infinite scroll implementation is working great! Good job team.",
];

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: {
      id: string;
      username: string;
      email: string;
      displayName: string;
      bio: string | null;
      avatarUrl: string | null;
      createdAt: string;
      lastSeen: string | null;
      roles: string[];
    };
  };
}

interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    lastSeen: string | null;
    roles: string[];
  };
}

interface MessageResponse {
  success: boolean;
  data: {
    id: string;
    messageNo: number;
    content: string;
  };
}

/**
 * Register a new user (fallback if login fails)
 */
async function register(
  username: string,
  password: string,
  email: string
): Promise<void> {
  console.log("📝 Registering new user...");

  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      email,
      password,
      displayName: username,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Registration failed: ${response.status} - ${error}`);
  }

  const result: RegisterResponse = await response.json();
  console.log(
    `✅ Registered user: ${result.data.username} (${result.data.id})`
  );
}

/**
 * Authenticate and get access token
 */
async function login(): Promise<string> {
  console.log("🔐 Logging in...");

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: CONFIG.username,
      password: CONFIG.password,
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    // If login fails with 401, try to register the user
    if (response.status === 401) {
      console.log(
        "⚠️  User not found or invalid credentials. Attempting registration..."
      );
      try {
        await register(
          CONFIG.username,
          CONFIG.password,
          `${CONFIG.username}@test.com`
        );

        // Try login again after registration
        console.log("🔐 Attempting login after registration...");
        const retryResponse = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier: CONFIG.username,
            password: CONFIG.password,
          }),
        });

        if (!retryResponse.ok) {
          const retryError = await retryResponse.text();
          throw new Error(
            `Login after registration failed: ${retryResponse.status} - ${retryError}`
          );
        }

        const retryResult: AuthResponse = await retryResponse.json();
        console.log(
          `✅ Logged in as ${retryResult.data.user.username} (${retryResult.data.user.id})`
        );
        return retryResult.data.access_token;
      } catch (registerError) {
        throw new Error(
          `Failed to register and login: ${registerError instanceof Error ? registerError.message : String(registerError)}`
        );
      }
    }

    throw new Error(`Login failed: ${response.status} - ${error}`);
  }

  const result: AuthResponse = await response.json();
  console.log(
    `✅ Logged in as ${result.data.user.username} (${result.data.user.id})`
  );

  return result.data.access_token;
}

/**
 * Send a message to a channel
 */
async function sendMessage(
  accessToken: string,
  workspaceId: string,
  channelId: string,
  content: string
): Promise<MessageResponse> {
  const response = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send message: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Generate varied message content
 */
function generateMessageContent(index: number): string {
  const templates = [
    ...MESSAGE_TEMPLATES,
    ...EXTENDED_MESSAGES,
    ...TECHNICAL_MESSAGES,
  ];
  const baseTemplate = templates[index % templates.length];

  // Add variations to make messages unique
  const variations = [
    baseTemplate,
    `${baseTemplate} (Message #${index + 1})`,
    `[${new Date().toLocaleTimeString()}] ${baseTemplate}`,
    `${baseTemplate} - Context: Testing pagination`,
    `Update: ${baseTemplate}`,
  ];

  return variations[index % variations.length];
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Seed messages for a single channel
 */
async function seedChannel(
  accessToken: string,
  channelId: string,
  channelName: string
): Promise<void> {
  console.log(
    `\n📨 Seeding ${CONFIG.messagesPerChannel} messages to ${channelName}...`
  );

  const totalBatches = Math.ceil(CONFIG.messagesPerChannel / CONFIG.batchSize);
  let successCount = 0;
  let errorCount = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * CONFIG.batchSize;
    const batchEnd = Math.min(
      batchStart + CONFIG.batchSize,
      CONFIG.messagesPerChannel
    );
    const batchSize = batchEnd - batchStart;

    console.log(
      `  Batch ${batch + 1}/${totalBatches} (messages ${batchStart + 1}-${batchEnd})...`
    );

    // Send messages in parallel within a batch
    const promises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      const content = generateMessageContent(i);
      promises.push(
        sendMessage(accessToken, CONFIG.workspaceId, channelId, content)
          .then(() => {
            successCount++;
            if (successCount % 50 === 0) {
              process.stdout.write(".");
            }
          })
          .catch((error) => {
            errorCount++;
            console.error(
              `\n  ❌ Error sending message ${i + 1}: ${error.message}`
            );
          })
      );
    }

    await Promise.all(promises);

    // Delay between batches to avoid overwhelming the server
    if (batch < totalBatches - 1) {
      await sleep(CONFIG.delayBetweenBatches);
    }
  }

  console.log(
    `\n  ✅ Channel seeding complete: ${successCount} succeeded, ${errorCount} failed`
  );
}

/**
 * Main seeding function
 */
async function main(): Promise<void> {
  console.log("🌱 Starting message seeding script\n");
  console.log(`Configuration:`);
  console.log(`  API URL: ${API_URL}`);
  console.log(`  Workspace ID: ${CONFIG.workspaceId}`);
  console.log(`  Channels: ${CONFIG.channels.length}`);
  console.log(`  Messages per channel: ${CONFIG.messagesPerChannel}`);
  console.log(
    `  Total messages: ${CONFIG.messagesPerChannel * CONFIG.channels.length}`
  );
  console.log(`  Batch size: ${CONFIG.batchSize}`);

  try {
    // Authenticate
    const accessToken = await login();

    // Seed each channel
    for (const channel of CONFIG.channels) {
      await seedChannel(accessToken, channel.id, channel.name);
    }

    console.log("\n✨ Seeding completed successfully!");
    console.log(
      `\nTotal messages created: ${CONFIG.messagesPerChannel * CONFIG.channels.length}`
    );
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run the script
main();
