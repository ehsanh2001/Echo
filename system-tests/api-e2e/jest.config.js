module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: ["tests/**/*.ts", "!tests/**/*.d.ts"],
  coverageDirectory: "coverage",
  verbose: true,
  testTimeout: 30000, // 30 seconds for e2e tests
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
