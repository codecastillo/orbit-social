import { defineConfig } from "@playwright/test";

// Anonymous smoke suite: boots the production build and walks the public
// routes. Supabase runs on placeholder env in CI, so data fetches fail into
// error/empty states by design; the suite asserts the shell renders and
// nothing hard-crashes, not that content loads.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:4321",
    colorScheme: "dark",
  },
  webServer: {
    command: "npx next start -p 4321",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
