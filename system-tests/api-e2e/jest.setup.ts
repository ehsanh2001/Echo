import dotenv from "dotenv";
import path from "path";

// Load environment variables from project root .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Set NODE_ENV to test to use test databases
process.env.NODE_ENV = "test";

// Configure test environment
console.log("🧪 E2E Test Environment Configuration:");
console.log(`  USER_SERVICE_URL: ${process.env.USER_SERVICE_URL}`);
console.log(
  `  WORKSPACE_CHANNEL_SERVICE_URL: ${process.env.WORKSPACE_CHANNEL_SERVICE_URL}`
);
console.log(`  MESSAGE_SERVICE_URL: ${process.env.MESSAGE_SERVICE_URL}`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
