import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    globalSetup: "src/__tests__/globalSetup.ts",
    testTimeout: 30000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      ADMIN_EMAIL: "test-admin@example.com",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/scorecast_test",
    },
  },
});
