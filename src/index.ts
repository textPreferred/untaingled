import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import knex from "knex";
import * as oidc from "openid-client";
import knexConfig from "./knexfile";
import { createSession, getSession, deleteSession } from "./sessions";
import { generateSalt, deriveKey, generateDbKey, encryptDbKey, decryptDbKey } from "./crypto";
import { basicAuth } from "./basicAuth";

const db = knex(knexConfig);
await db.migrate.latest();

// ── Auth0 / OIDC setup ────────────────────────────────────────────────────────

const IS_TEST = process.env["NODE_ENV"] === "test";

const AUTH0_DOMAIN = process.env["AUTH0_DOMAIN"] ?? "";
const AUTH0_CLIENT_ID = process.env["AUTH0_CLIENT_ID"] ?? "";
const AUTH0_CLIENT_SECRET = process.env["AUTH0_CLIENT_SECRET"] ?? "";
const AUTH0_CALLBACK_URL = process.env["AUTH0_CALLBACK_URL"] ?? "";

const oidcConfig = IS_TEST
  ? null
  : await oidc.discovery(new URL(`https://${AUTH0_DOMAIN}`), AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET);

// Pending OIDC states: state → { codeVerifier, nonce }
const pendingAuth = new Map<string, { codeVerifier: string; nonce: string }>();

// Pending passphrase sessions: tempToken → { auth0Sub, isNewUser, encryptedDbKey?, keySalt?, passwordHash? }
type PendingPassphrase = {
  auth0Sub: string;
  isNewUser: boolean;
  encryptedDbKey?: string;
  keySalt?: string;
  // migration path: legacy credentials still present
  needsMigration?: boolean;
  passwordHash?: string | undefined;
  legacySalt?: string | undefined;
};
const pendingPassphrase = new Map<string, PendingPassphrase>();

function makeTempToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono();

const basicAuthUser = process.env["BASIC_AUTH_USER"];
const basicAuthPassword = process.env["BASIC_AUTH_PASSWORD"];
if (basicAuthUser && basicAuthPassword) {
  app.use("/*", basicAuth(basicAuthUser, basicAuthPassword));
}

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRow = {
  id: number;
  auth0_sub: string | null;
  password_hash: string | null;
  encrypted_db_key: string;
  key_salt: string;
};
type EventRow = {
  id: number;
  title: string;
  description: string | null;
  root_event_id: number | null;
};

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireSession(c: Context): { userId: number; dbKey: Buffer } | null {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return null;
  return getSession(sessionId) ?? null;
}

// ── Test-only login endpoint (bypasses Auth0) ─────────────────────────────────

if (IS_TEST) {
  app.post("/api/test/login", async (c) => {
    const { username, passphrase } = await c.req.json<{ username: string; passphrase: string }>();

    let user = (await db("users").where({ username }).first()) as UserRow | undefined;
    if (!user) {
      const salt = generateSalt();
      const dbKey = generateDbKey();
      const encryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, salt));
      const [created] = await db("users")
        .insert({
          username,
          auth0_sub: `test|${username}`,
          encrypted_db_key: encryptedDbKey,
          key_salt: salt,
        })
        .returning(["id", "auth0_sub", "password_hash", "encrypted_db_key", "key_salt"]);
      user = created as UserRow;
      const sessionId = createSession(user!.id, dbKey);
      setCookie(c, "session", sessionId, { httpOnly: true, path: "/" });
      return c.json({ ok: true });
    }

    let dbKey: Buffer;
    try {
      dbKey = decryptDbKey(user.encrypted_db_key, deriveKey(passphrase, user.key_salt));
    } catch {
      return c.json({ error: "Wrong passphrase" }, 401);
    }
    const sessionId = createSession(user.id, dbKey);
    setCookie(c, "session", sessionId, { httpOnly: true, path: "/" });
    return c.json({ ok: true });
  });
}

// ── Auth0 login initiation ────────────────────────────────────────────────────

app.get("/auth/login", async (c) => {
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();

  pendingAuth.set(state, { codeVerifier, nonce });

  const url = oidc.buildAuthorizationUrl(oidcConfig!, {
    redirect_uri: AUTH0_CALLBACK_URL,
    response_type: "code",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return c.redirect(url.href, 302);
});

// ── Auth0 callback ────────────────────────────────────────────────────────────

app.get("/auth/callback", async (c) => {
  const state = c.req.query("state") ?? "";
  const pending = pendingAuth.get(state);
  if (!pending) return c.text("Invalid state", 400);
  pendingAuth.delete(state);

  const callbackUrl = new URL(c.req.url);

  const tokens = await oidc.authorizationCodeGrant(oidcConfig!, callbackUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedNonce: pending.nonce,
    expectedState: state,
  });

  const claims = tokens.claims();
  if (!claims?.sub) return c.text("Missing sub claim", 400);
  const auth0Sub = claims.sub;

  const user = (await db("users").where({ auth0_sub: auth0Sub }).first()) as UserRow | undefined;

  const tempToken = makeTempToken();

  if (!user) {
    const hasLegacyUsers = await db("users")
      .whereNull("auth0_sub")
      .whereNotNull("password_hash")
      .first();
    if (hasLegacyUsers) {
      // Might be a legacy user — ask them to identify themselves
      pendingPassphrase.set(tempToken, { auth0Sub, isNewUser: false, needsMigration: true });
    } else {
      // Brand new user
      pendingPassphrase.set(tempToken, { auth0Sub, isNewUser: true });
    }
  } else {
    // Returning Auth0 user — needs passphrase to decrypt dbKey
    pendingPassphrase.set(tempToken, {
      auth0Sub,
      isNewUser: false,
      encryptedDbKey: user.encrypted_db_key,
      keySalt: user.key_salt,
    });
  }

  const isMigration = pendingPassphrase.get(tempToken)?.needsMigration ?? false;
  setCookie(c, "pending_auth", tempToken, { httpOnly: true, path: "/", maxAge: 600 });
  return c.redirect(isMigration ? "/auth/passphrase?migrate=1" : "/auth/passphrase", 302);
});

// ── Passphrase submission ─────────────────────────────────────────────────────

app.post("/api/auth/passphrase", async (c) => {
  const tempToken = getCookie(c, "pending_auth");
  if (!tempToken) return c.json({ error: "Session expired" }, 401);

  const pending = pendingPassphrase.get(tempToken);
  if (!pending) return c.json({ error: "Session expired" }, 401);

  const { passphrase, username: legacyUsername } = await c.req.json<{
    passphrase: string;
    username?: string;
  }>();
  if (!passphrase) return c.json({ error: "Passphrase required" }, 400);

  let userId: number;
  let dbKey: Buffer;

  if (pending.isNewUser) {
    // Create new user
    const salt = generateSalt();
    dbKey = generateDbKey();
    const encryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, salt));
    const [user] = await db("users")
      .insert({ auth0_sub: pending.auth0Sub, encrypted_db_key: encryptedDbKey, key_salt: salt })
      .returning(["id"]);
    userId = user.id as number;
  } else if (pending.needsMigration) {
    if (!legacyUsername) return c.json({ error: "Username required for migration" }, 400);
    const user = (await db("users")
      .whereNull("auth0_sub")
      .whereNotNull("password_hash")
      .where({ username: legacyUsername })
      .first()) as UserRow | undefined;
    if (!user) return c.json({ error: "Invalid credentials" }, 401);

    const valid = await Bun.password.verify(passphrase, user.password_hash!);
    if (!valid) return c.json({ error: "Invalid credentials" }, 401);

    dbKey = decryptDbKey(user.encrypted_db_key, deriveKey(passphrase, user.key_salt));

    // Re-encrypt dbKey: passphrase is now the encryption passphrase too
    const newSalt = generateSalt();
    const newEncryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, newSalt));
    await db("users").where({ id: user.id }).update({
      auth0_sub: pending.auth0Sub,
      encrypted_db_key: newEncryptedDbKey,
      key_salt: newSalt,
      password_hash: null,
    });
    userId = user.id;
  } else {
    // Returning user — decrypt with passphrase
    try {
      dbKey = decryptDbKey(pending.encryptedDbKey!, deriveKey(passphrase, pending.keySalt!));
    } catch {
      return c.json({ error: "Wrong passphrase" }, 401);
    }
    const user = (await db("users").where({ auth0_sub: pending.auth0Sub }).first()) as
      | UserRow
      | undefined;
    if (!user) return c.json({ error: "User not found" }, 400);
    userId = user.id;
  }

  pendingPassphrase.delete(tempToken);
  deleteCookie(c, "pending_auth", { path: "/" });

  const sessionId = createSession(userId, dbKey);
  setCookie(c, "session", sessionId, { httpOnly: true, path: "/" });
  return c.json({ ok: true });
});

// ── Logout ────────────────────────────────────────────────────────────────────

app.post("/api/logout", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) deleteSession(sessionId);
  deleteCookie(c, "session", { path: "/" });
  return c.body(null, 204);
});

// ── Auth guard ────────────────────────────────────────────────────────────────

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/auth/passphrase") return next();
  if (!requireSession(c)) return c.json({ error: "Unauthorized" }, 401);
  return next();
});

// ── Events ────────────────────────────────────────────────────────────────────

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
