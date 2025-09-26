import { redisService } from "../src/utils/redis";
import { prisma } from "../src/config/prisma";

// Global test setup
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await redisService.connect();

  // Connect to database
  await prisma.$connect();

  console.log("✅ Test environment setup complete");
});

afterAll(async () => {
  // Final cleanup - only clean up connections, individual tests handle their own data cleanup

  // Cleanup connections after all tests
  await redisService.disconnect();
  await prisma.$disconnect();

  console.log("✅ Test environment cleanup complete");
});
