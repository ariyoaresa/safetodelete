import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    exclude: ["fixtures/**", "node_modules/**", "dist/**"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      "@safetodelete/report-schema": path.resolve(__dirname, "packages/report-schema/src/index.ts"),
      "@safetodelete/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@safetodelete/language-js-ts": path.resolve(__dirname, "packages/language-js-ts/src/index.ts"),
      "@safetodelete/dependency-graph": path.resolve(__dirname, "packages/dependency-graph/src/index.ts"),
      "@safetodelete/analyzer": path.resolve(__dirname, "packages/analyzer/src/index.ts"),
      "@safetodelete/simulator": path.resolve(__dirname, "packages/simulator/src/index.ts"),
      "@safetodelete/runner": path.resolve(__dirname, "packages/runner/src/index.ts"),
      "@safetodelete/risk-engine": path.resolve(__dirname, "packages/risk-engine/src/index.ts"),
      "@safetodelete/ai": path.resolve(__dirname, "packages/ai/src/index.ts"),
      "@safetodelete/cli": path.resolve(__dirname, "packages/cli/src/index.ts"),
    },
  },
});
