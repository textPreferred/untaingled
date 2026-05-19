import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { setCookie } from "hono/cookie";
import type { Context } from "hono";
import knex from "knex";
import knexConfig from "./knexfile";
import { createSession } from "./sessions";
import { generateSalt, deriveKey, generateDbKey, encryptDbKey, decryptDbKey } from "./crypto";

const db = knex(knexConfig);
await db.migrate.latest();

const app = new Hono();

/**
 * Starts a new user session by creating a session ID and setting it as a cookie.
 *
 * @param c The context object for the current request/response cycle.
 * @param userId The ID of the user for whom the session is started.
 * @param dbKey The database key used to create the session.
 */
export function startSession(c: Context, userId: number, dbKey: Buffer) {
  const sessionId = createSession(userId, dbKey);
  setCookie(c, "session", sessionId, { httpOnly: true, path: "/" });
}

app.post("/api/register", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

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

  startSession(c, user.id as number, dbKey);
  return c.redirect("/app", 302);
});

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

  const user = (await db("users").where({ username }).first()) as
    | { id: number; password_hash: string; encrypted_db_key: string; key_salt: string }
    | undefined;

  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await Bun.password.verify(password, user.password_hash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const dbKey = decryptDbKey(user.encrypted_db_key, deriveKey(password, user.key_salt));
  startSession(c, user.id, dbKey);
  return c.redirect("/app", 302);
});

app.use("/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ path: "./dist/client/index.html" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
