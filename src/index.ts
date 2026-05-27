import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import knex from "knex";
import knexConfig from "./knexfile";
import { createSession, deleteSession } from "./sessions";
import { generateSalt, deriveKey, generateDbKey, encryptDbKey, decryptDbKey } from "./crypto";
import { basicAuth } from "./basicAuth";

const db = knex(knexConfig);
await db.migrate.latest();

const app = new Hono();

const basicAuthUser = process.env["BASIC_AUTH_USER"];
const basicAuthPassword = process.env["BASIC_AUTH_PASSWORD"];
if (basicAuthUser && basicAuthPassword) {
  app.use("/*", basicAuth(basicAuthUser, basicAuthPassword));
}

/**
 * Starts a new user session by creating a session ID and setting it as a cookie.
 *
 * @param c The context object for the current request/response cycle.
 * @param userId The ID of the user for whom the session is started.
 * @param dbKey The database key used to create the session.
 */
type Credentials = { username: string; password: string };
type UserRow = {
  id: number;
  password_hash: string;
  encrypted_db_key: string;
  key_salt: string;
};
type EventRow = {
  id: number;
  title: string;
  description: string | null;
  root_event_id: number | null;
};

/**
 * Starts a new user session by creating a session and setting a session cookie.
 *
 * @param c - The context object used for handling the request/response cycle.
 * @param userId - The user ID for which the session is to be created.
 * @param dbKey - The database key buffer used to secure the session.
 */
function startSession(c: Context, userId: number, dbKey: Buffer) {
  const sessionId = createSession(userId, dbKey);
  setCookie(c, "session", sessionId, { httpOnly: true, path: "/" });
}

/**
 * Logs in a user by starting a session and redirects them to the application.
 *
 * @param c - The request context containing request and response objects.
 * @param userId - The ID of the user to log in.
 * @param dbKey - The database key buffer used for session encryption.
 * @returns The result of the redirect operation.
 */
function loginAndRedirect(c: Context, userId: number, dbKey: Buffer) {
  startSession(c, userId, dbKey);
  return c.redirect("/app", 302);
}

app.post("/api/register", async (c) => {
  const { username, password } = await c.req.json<Credentials>();

  const existing = await db("users").where({ username }).first();
  if (existing) return c.json({ error: "Username taken" }, 409);

  const passwordHash = await Bun.password.hash(password);
  const salt = generateSalt();
  const dbKey = generateDbKey();
  const encryptedDbKey = encryptDbKey(dbKey, deriveKey(password, salt));

  const [user] = await db("users")
    .insert({
      username,
      password_hash: passwordHash,
      encrypted_db_key: encryptedDbKey,
      key_salt: salt,
    })
    .returning(["id"]);

  return loginAndRedirect(c, user.id as number, dbKey);
});

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json<Credentials>();

  const user = (await db("users").where({ username }).first()) as UserRow | undefined;
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await Bun.password.verify(password, user.password_hash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const dbKey = decryptDbKey(user.encrypted_db_key, deriveKey(password, user.key_salt));
  return loginAndRedirect(c, user.id, dbKey);
});

app.post("/api/logout", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) deleteSession(sessionId);
  deleteCookie(c, "session", { path: "/" });
  return c.body(null, 204);
});

app.get("/api/events", async (c) => {
  const events = await db("events").select<EventRow[]>();
  return c.json(events);
});

app.post("/api/events", async (c) => {
  const body = await c.req.json<{ title?: string; description?: string; root_event_id?: number }>();
  if (!body.title?.trim()) return c.json({ error: "Title is required" }, 400);
  const [event] = await db("events")
    .insert({
      title: body.title.trim(),
      description: body.description ?? null,
      root_event_id: body.root_event_id ?? null,
    })
    .returning<EventRow[]>(["id", "title", "description", "root_event_id"]);
  return c.json(event, 201);
});

app.patch("/api/events/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const existing = await db("events").where({ id }).first<EventRow>();
  if (!existing) return c.json({ error: "Not found" }, 404);
  const body = await c.req.json<{
    title?: string;
    description?: string;
    root_event_id?: number | null;
  }>();
  if (body.title !== undefined && !body.title.trim())
    return c.json({ error: "Title is required" }, 400);
  const [event] = await db("events")
    .where({ id })
    .update({
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.root_event_id !== undefined ? { root_event_id: body.root_event_id } : {}),
    })
    .returning<EventRow[]>(["id", "title", "description", "root_event_id"]);
  return c.json(event);
});

app.delete("/api/events/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const deleted = await db("events").where({ id }).delete();
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.body(null, 204);
});

app.use("/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ path: "./dist/client/index.html" }));

const server = Bun.serve({ port: 3000, fetch: app.fetch });
console.log(`Listening on http://localhost:${server.port}`);

/**
 * Gracefully shuts down the server and database, then exits the process.
 *
 * @returns {Promise<void>} Resolves when shutdown is complete.
 */
async function shutdown() {
  await server.stop();
  await db.destroy();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
