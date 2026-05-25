import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "bunx knex --knexfile src/knexfile.ts migrate:rollback --all && bun dev",
    port: 3000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL:
        process.env["DATABASE_URL"] ??
        "postgresql://postgres:postgres@localhost:5432/untaingled_test",
    },
  },
});
