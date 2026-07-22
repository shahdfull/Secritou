import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      thresholds: {
        // Measured real coverage on 2026-07-22 (`npx vitest run --coverage`): statements 47.18%,
        // branches 44%, functions 37.11%, lines 48.2%. Set a few points below each so normal
        // variance doesn't break CI, while catching a real drop rather than being 1% (no signal
        // at all — a project that lost 90% of its tests would still pass). Raise in increments as
        // real coverage improves; do not raise as a one-off "make the number bigger" edit.
        statements: 40,
        branches: 38,
        functions: 32,
        lines: 40,
      },
    },
  },
});
