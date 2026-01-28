import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    globalSetup: "src/__tests__/globalSetup.ts",
    testTimeout: 30000,
    fileParallelism: false,
  },
});
