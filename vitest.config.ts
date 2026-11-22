import { defineConfig } from "vitest/config";

export default defineConfig({
  // The automatic JSX runtime needs no React import in every file.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
