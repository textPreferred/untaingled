import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    httpCredentials: { username: "test", password: "test" },
  },
  webServer: {
    command:
      "bun -e \"import knex from 'knex'; import config from './src/knexfile'; const db = knex(config); await db.migrate.rollback({}, true); await db.destroy()\" && bun dev",
    port: 3000,
    reuseExistingServer: false,
  },
});
