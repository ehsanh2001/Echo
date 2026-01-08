/**
 * Script to send N messages to a channel for testing purposes
 * Run with: npx ts-node send_n_msg.ts
 */

import axios from "axios";

// Configuration - Change these values as needed
const CONFIG = {
  BFF_BASE_URL: "http://localhost:8004",
  EMAIL: "ehsanh2001@gmail.com",
  PASSWORD: "Password123",
  WORKSPACE_ID: "688321e5-9c67-49fa-aaf9-c643d7183154",
  CHANNEL_ID: "36dceb8b-a96e-4512-9979-a8bb13fdea0a",
  N: 200,
  START_COUNTER: 241,
  MESSAGE_CONTENT: "Test message",
};

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    user: {
      id: string;
      email: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
}

interface SendMessageResponse {
  success: boolean;
  data: {
    id: string;
    content: string;
    messageNumber: number;
  };
}

async function login(): Promise<string> {
  console.log(`🔐 Logging in as ${CONFIG.EMAIL}...`);

  try {
    const response = await axios.post<LoginResponse>(
      `${CONFIG.BFF_BASE_URL}/api/auth/login`,
      {
        identifier: CONFIG.EMAIL,
        password: CONFIG.PASSWORD,
      }
    );

    console.log("✅ Login successful");
    return response.data.data.access_token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Login failed:", error.response?.data || error.message);
    } else {
      console.error("❌ Login failed:", error);
    }
    throw error;
  }
}

async function sendMessage(
  accessToken: string,
  content: string,
  messageIndex: number
): Promise<void> {
  try {
    const response = await axios.post<SendMessageResponse>(
      `${CONFIG.BFF_BASE_URL}/api/workspaces/${CONFIG.WORKSPACE_ID}/channels/${CONFIG.CHANNEL_ID}/messages`,
      {
        content,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(
      `✅ Message ${messageIndex}/${CONFIG.N} sent (messageNo: ${response.data.data.messageNumber})`
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `❌ Failed to send message ${messageIndex}:`,
        error.response?.data || error.message
      );
    } else {
      console.error(`❌ Failed to send message ${messageIndex}:`, error);
    }
    throw error;
  }
}

async function main() {
  console.log("📨 Starting message sender script...");
  console.log(`📊 Configuration:
  - BFF URL: ${CONFIG.BFF_BASE_URL}
  - Workspace ID: ${CONFIG.WORKSPACE_ID}
  - Channel ID: ${CONFIG.CHANNEL_ID}
  - Number of messages: ${CONFIG.N}
  - Start counter: ${CONFIG.START_COUNTER}
  - Message content: "${CONFIG.MESSAGE_CONTENT}"
`);

  try {
    // Step 1: Login
    const accessToken = await login();

    // Step 2: Send N messages
    console.log(`\n📤 Sending ${CONFIG.N} messages...`);

    for (let i = 0; i < CONFIG.N; i++) {
      const counter = CONFIG.START_COUNTER + i;
      const content = `${CONFIG.MESSAGE_CONTENT} #${counter}`;

      await sendMessage(accessToken, content, i + 1);

      // Small delay to avoid overwhelming the server
      if (i < CONFIG.N - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    console.log(`\n✅ Successfully sent all ${CONFIG.N} messages!`);
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

// Run the script
main();
