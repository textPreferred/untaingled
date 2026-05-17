import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "rm -f users.db && bun dev",
    port: 3000,
    reuseExistingServer: false,
  },
});
