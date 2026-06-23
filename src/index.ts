import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { db } from "./db";
import { basicAuth } from "./basicAuth";
import { authGuard, csrfGuard } from "./middleware";
import { startPendingSweep } from "./auth/pendingStore";
import { registerAuthRoutes } from "./routes/auth";
import { registerEventRoutes } from "./routes/events";

await db.migrate.latest();
startPendingSweep();

const app = new Hono();

// Health check — registered before any auth so probes need no credentials.
app.get("/health", (c) => c.text("OK"));

const basicAuthUser = process.env["BASIC_AUTH_USER"];
const basicAuthPassword = process.env["BASIC_AUTH_PASSWORD"];
if (basicAuthUser && basicAuthPassword) {
  app.use("/*", basicAuth(basicAuthUser, basicAuthPassword));
}

// Pipeline order is load-bearing: CSRF guard first, then the auth routes (some
// run before a session exists), then the auth guard, then the guarded events.
app.use("/api/*", csrfGuard);
registerAuthRoutes(app);
app.use("/api/*", authGuard);
registerEventRoutes(app);

// ── Static ────────────────────────────────────────────────────────────────────

app.use("/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ path: "./dist/client/index.html" }));

// ── Server ────────────────────────────────────────────────────────────────────

const server = Bun.serve({ port: 3000, fetch: app.fetch });
console.log(`Listening on http://localhost:${server.port}`);

async function shutdown() {
  await server.stop();
  await db.destroy();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
