import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import knex from "knex";
import * as oidc from "openid-client";
import knexConfig from "./knexfile";
import { createSession, getSession, deleteSession } from "./sessions";
import {
  generateSalt,
  deriveKey,
  generateDbKey,
  encryptDbKey,
  decryptDbKey,
  encryptString,
  decryptString,
  lookupToken,
  parseKdfParams,
  serializeKdfParams,
  CURRENT_KDF_PARAMS,
} from "./crypto";
import { basicAuth } from "./basicAuth";
import { isValidDate, normalizeDate, dateParents } from "./dateValidation";

const db = knex(knexConfig);
await db.migrate.latest();

// ── Auth0 / OIDC setup ────────────────────────────────────────────────────────

const IS_TEST = process.env["NODE_ENV"] === "test";
const IS_PROD = process.env["NODE_ENV"] === "production";

// Shared cookie hardening: HttpOnly + SameSite=Lax always; Secure in prod
// (omitted in dev/test so cookies work over plain http://localhost).
const SESSION_COOKIE = { httpOnly: true, path: "/", sameSite: "Lax", secure: IS_PROD } as const;

const AUTH0_DOMAIN = process.env["AUTH0_DOMAIN"] ?? "";
const AUTH0_CLIENT_ID = process.env["AUTH0_CLIENT_ID"] ?? "";
const AUTH0_CLIENT_SECRET = process.env["AUTH0_CLIENT_SECRET"] ?? "";
const AUTH0_CALLBACK_URL = process.env["AUTH0_CALLBACK_URL"] ?? "";

const oidcConfig = IS_TEST
  ? null
  : await oidc.discovery(new URL(`https://${AUTH0_DOMAIN}`), AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET);

// Half-finished logins must not accumulate forever, so every pending entry
// carries an expiry and stale ones are swept periodically.
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 min (matches the pending_auth cookie)

// Pending OIDC states: state → { codeVerifier, nonce }
const pendingAuth = new Map<string, { codeVerifier: string; nonce: string; expiresAt: number }>();

// Pending passphrase sessions: tempToken → { auth0Sub, isNewUser, encryptedDbKey?, keySalt?, passwordHash? }
type PendingPassphrase = {
  auth0Sub: string;
  isNewUser: boolean;
  encryptedDbKey?: string;
  keySalt?: string;
  keyParams?: string | null;
  // migration path: legacy credentials still present
  needsMigration?: boolean;
  passwordHash?: string | undefined;
  legacySalt?: string | undefined;
  expiresAt: number;
};
const pendingPassphrase = new Map<string, PendingPassphrase>();

function makeTempToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
}

// Reads an entry only if it hasn't expired, purging it on access either way.
function takeFresh<T extends { expiresAt: number }>(
  map: Map<string, T>,
  key: string,
): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return undefined;
  }
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingAuth) if (v.expiresAt <= now) pendingAuth.delete(k);
  for (const [k, v] of pendingPassphrase) if (v.expiresAt <= now) pendingPassphrase.delete(k);
}, PENDING_TTL_MS).unref();

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono();

// Health check — registered before any auth so probes need no credentials.
app.get("/health", (c) => c.text("OK"));

const basicAuthUser = process.env["BASIC_AUTH_USER"];
const basicAuthPassword = process.env["BASIC_AUTH_PASSWORD"];
if (basicAuthUser && basicAuthPassword) {
  app.use("/*", basicAuth(basicAuthUser, basicAuthPassword));
}

// ── CSRF guard ──────────────────────────────────────────────────────────────
// Browsers send Origin on cross-site state-changing requests; reject those
// whose Origin host doesn't match the request Host. Header-less clients
// (curl, server-to-server) aren't a CSRF vector, so they pass. Pairs with the
// SameSite=Lax session cookie as defense-in-depth.
app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = c.req.header("Origin");
    if (origin !== undefined) {
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return c.json({ error: "Invalid origin" }, 403);
      }
      if (originHost !== c.req.header("Host")) return c.json({ error: "Invalid origin" }, 403);
    }
  }
  return next();
});

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRow = {
  id: number;
  auth0_sub: string | null;
  password_hash: string | null;
  encrypted_db_key: string;
  key_salt: string;
  kdf_params: string | null;
};
type EventKind = "event" | "date";

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  kind: EventKind;
};
type EventWithRoots = EventRow & { root_event_ids: number[] };

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireSession(c: Context): { userId: number; dbKey: Buffer } | null {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return null;
  return getSession(sessionId) ?? null;
}

const CURRENT_KDF_PARAMS_SERIALIZED = serializeKdfParams(CURRENT_KDF_PARAMS);

/**
 * Re-wraps a user's dbKey under the current scrypt cost when their stored
 * params are below target. Called right after a successful login, while we
 * still hold the plaintext passphrase. The dbKey itself is unchanged, so event
 * ciphertext is untouched — only the small key envelope is rewritten.
 *
 * @param userId The id of the user whose envelope may need upgrading.
 * @param passphrase The plaintext passphrase (just verified).
 * @param dbKey The decrypted dbKey to re-wrap.
 * @param storedParams The user's currently stored kdf_params value.
 */
async function upgradeKdfParams(
  userId: number,
  passphrase: string,
  dbKey: Buffer,
  storedParams: string | null,
): Promise<void> {
  if (storedParams === CURRENT_KDF_PARAMS_SERIALIZED) return;
  const newSalt = generateSalt();
  const newEncryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, newSalt, CURRENT_KDF_PARAMS));
  await db("users").where({ id: userId }).update({
    encrypted_db_key: newEncryptedDbKey,
    key_salt: newSalt,
    kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
  });
}

// ── Test-only login endpoint (bypasses Auth0) ─────────────────────────────────

if (IS_TEST) {
  app.post("/api/test/login", async (c) => {
    const { username, passphrase } = await c.req.json<{ username: string; passphrase: string }>();

    let user = (await db("users").where({ username }).first()) as UserRow | undefined;
    if (!user) {
      const salt = generateSalt();
      const dbKey = generateDbKey();
      const encryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, salt, CURRENT_KDF_PARAMS));
      const [created] = await db("users")
        .insert({
          username,
          auth0_sub: `test|${username}`,
          encrypted_db_key: encryptedDbKey,
          key_salt: salt,
          kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
        })
        .returning([
          "id",
          "auth0_sub",
          "password_hash",
          "encrypted_db_key",
          "key_salt",
          "kdf_params",
        ]);
      user = created as UserRow;
      const sessionId = createSession(user!.id, dbKey);
      setCookie(c, "session", sessionId, SESSION_COOKIE);
      return c.json({ ok: true });
    }

    let dbKey: Buffer;
    try {
      dbKey = decryptDbKey(
        user.encrypted_db_key,
        deriveKey(passphrase, user.key_salt, parseKdfParams(user.kdf_params)),
      );
    } catch {
      return c.json({ error: "Wrong passphrase" }, 401);
    }
    await upgradeKdfParams(user.id, passphrase, dbKey, user.kdf_params);
    const sessionId = createSession(user.id, dbKey);
    setCookie(c, "session", sessionId, SESSION_COOKIE);
    return c.json({ ok: true });
  });
}

// ── Auth0 login initiation ────────────────────────────────────────────────────

app.get("/auth/login", async (c) => {
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();

  pendingAuth.set(state, { codeVerifier, nonce, expiresAt: Date.now() + PENDING_TTL_MS });

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
  const pending = takeFresh(pendingAuth, state);
  if (!pending) return c.text("Invalid state", 400);
  pendingAuth.delete(state);

  const callbackUrl = new URL(AUTH0_CALLBACK_URL);
  callbackUrl.search = new URL(c.req.url).search;

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
  const expiresAt = Date.now() + PENDING_TTL_MS;

  if (!user) {
    const hasLegacyUsers = await db("users")
      .whereNull("auth0_sub")
      .whereNotNull("password_hash")
      .first();
    if (hasLegacyUsers) {
      // Might be a legacy user — ask them to identify themselves
      pendingPassphrase.set(tempToken, {
        auth0Sub,
        isNewUser: false,
        needsMigration: true,
        expiresAt,
      });
    } else {
      // Brand new user
      pendingPassphrase.set(tempToken, { auth0Sub, isNewUser: true, expiresAt });
    }
  } else {
    // Returning Auth0 user — needs passphrase to decrypt dbKey
    pendingPassphrase.set(tempToken, {
      auth0Sub,
      isNewUser: false,
      encryptedDbKey: user.encrypted_db_key,
      keySalt: user.key_salt,
      keyParams: user.kdf_params,
      expiresAt,
    });
  }

  const isMigration = pendingPassphrase.get(tempToken)?.needsMigration ?? false;
  setCookie(c, "pending_auth", tempToken, { ...SESSION_COOKIE, maxAge: 600 });
  return c.redirect(isMigration ? "/auth/passphrase?migrate=1" : "/auth/passphrase", 302);
});

// ── Passphrase submission ─────────────────────────────────────────────────────

app.post("/api/auth/passphrase", async (c) => {
  const tempToken = getCookie(c, "pending_auth");
  if (!tempToken) return c.json({ error: "Session expired" }, 401);

  const pending = takeFresh(pendingPassphrase, tempToken);
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
    const encryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, salt, CURRENT_KDF_PARAMS));
    const [user] = await db("users")
      .insert({
        auth0_sub: pending.auth0Sub,
        encrypted_db_key: encryptedDbKey,
        key_salt: salt,
        kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
      })
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

    dbKey = decryptDbKey(
      user.encrypted_db_key,
      deriveKey(passphrase, user.key_salt, parseKdfParams(user.kdf_params)),
    );

    // Re-encrypt dbKey: passphrase is now the encryption passphrase too, and
    // re-wrap at the current scrypt cost while we're at it.
    const newSalt = generateSalt();
    const newEncryptedDbKey = encryptDbKey(
      dbKey,
      deriveKey(passphrase, newSalt, CURRENT_KDF_PARAMS),
    );
    await db("users").where({ id: user.id }).update({
      auth0_sub: pending.auth0Sub,
      encrypted_db_key: newEncryptedDbKey,
      key_salt: newSalt,
      kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
      password_hash: null,
    });
    userId = user.id;
  } else {
    // Returning user — decrypt with passphrase under their stored params
    try {
      dbKey = decryptDbKey(
        pending.encryptedDbKey!,
        deriveKey(passphrase, pending.keySalt!, parseKdfParams(pending.keyParams)),
      );
    } catch {
      return c.json({ error: "Wrong passphrase" }, 401);
    }
    const user = (await db("users").where({ auth0_sub: pending.auth0Sub }).first()) as
      | UserRow
      | undefined;
    if (!user) return c.json({ error: "User not found" }, 400);
    userId = user.id;
    await upgradeKdfParams(userId, passphrase, dbKey, pending.keyParams ?? null);
  }

  pendingPassphrase.delete(tempToken);
  deleteCookie(c, "pending_auth", { path: "/" });

  const sessionId = createSession(userId, dbKey);
  setCookie(c, "session", sessionId, SESSION_COOKIE);
  return c.json({ ok: true });
});

// ── Change passphrase ─────────────────────────────────────────────────────────

app.post("/api/auth/change-passphrase", async (c) => {
  const session = requireSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const { currentPassphrase, newPassphrase } = await c.req.json<{
    currentPassphrase?: string;
    newPassphrase?: string;
  }>();
  if (!currentPassphrase || !newPassphrase)
    return c.json({ error: "Both passphrases required" }, 400);

  const user = (await db("users").where({ id: session.userId }).first()) as UserRow | undefined;
  if (!user) return c.json({ error: "User not found" }, 404);

  try {
    decryptDbKey(
      user.encrypted_db_key,
      deriveKey(currentPassphrase, user.key_salt, parseKdfParams(user.kdf_params)),
    );
  } catch {
    return c.json({ error: "Wrong passphrase" }, 401);
  }

  const newSalt = generateSalt();
  const newEncryptedDbKey = encryptDbKey(
    session.dbKey,
    deriveKey(newPassphrase, newSalt, CURRENT_KDF_PARAMS),
  );
  await db("users").where({ id: session.userId }).update({
    encrypted_db_key: newEncryptedDbKey,
    key_salt: newSalt,
    kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
  });

  return c.body(null, 204);
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

// Stored rows hold encrypted title/description; decryptEvent turns one into
// the plaintext API shape using the requester's per-user dbKey.
type StoredEventRow = { id: number; title: string; description: string | null; kind: EventKind };

function decryptEvent(row: StoredEventRow, dbKey: Buffer): EventRow {
  return {
    id: row.id,
    title: decryptString(row.title, dbKey),
    description: row.description === null ? null : decryptString(row.description, dbKey),
    kind: row.kind,
  };
}

// ── Event persistence (low-level: encryption + queries) ───────────────────────

async function insertEvent(
  userId: number,
  dbKey: Buffer,
  fields: { title: string; description: string | null; kind: EventKind; dateLookup?: string },
): Promise<number> {
  const [created] = await db("events")
    .insert({
      title: encryptString(fields.title, dbKey),
      description: fields.description === null ? null : encryptString(fields.description, dbKey),
      kind: fields.kind,
      user_id: userId,
      ...(fields.dateLookup !== undefined ? { date_lookup: fields.dateLookup } : {}),
    })
    .returning<{ id: number }[]>(["id"]);
  if (!created) throw new Error("Failed to create event");
  return created.id;
}

async function updateEventFields(
  id: number,
  userId: number,
  dbKey: Buffer,
  fields: { title?: string; description?: string | null },
): Promise<void> {
  const patch: { title?: string; description?: string | null } = {};
  if (fields.title !== undefined) patch.title = encryptString(fields.title, dbKey);
  if (fields.description !== undefined)
    patch.description =
      fields.description === null ? null : encryptString(fields.description, dbKey);
  await db("events").where({ id, user_id: userId }).update(patch);
}

async function findEvent(id: number, userId: number): Promise<StoredEventRow | undefined> {
  return db("events").where({ id, user_id: userId }).first<StoredEventRow>();
}

async function findDateEventId(
  date: string,
  userId: number,
  dbKey: Buffer,
): Promise<number | undefined> {
  const existing = await db("events")
    .where({ kind: "date", user_id: userId, date_lookup: lookupToken(date, dbKey) })
    .first<{ id: number }>();
  return existing?.id;
}

async function deleteEvent(id: number, userId: number): Promise<number> {
  return db("events").where({ id, user_id: userId }).delete();
}

// Keep only root ids the user owns — blocks cross-user links (IDOR via roots).
async function ownedRootIds(rootIds: number[], userId: number): Promise<number[]> {
  const unique = [...new Set(rootIds)];
  if (unique.length === 0) return [];
  const owned = await db("events")
    .whereIn("id", unique)
    .where({ user_id: userId })
    .select<{ id: number }[]>("id");
  return owned.map((e) => e.id);
}

async function replaceRoots(eventId: number, rootIds: number[]): Promise<void> {
  await db("event_roots").where({ event_id: eventId }).delete();
  if (rootIds.length > 0) {
    await db("event_roots").insert(
      rootIds.map((root_event_id) => ({ event_id: eventId, root_event_id })),
    );
  }
}

async function loadUserEvents(userId: number): Promise<StoredEventRow[]> {
  return db("events").where({ user_id: userId }).select<StoredEventRow[]>();
}

async function loadRootsFor(
  eventIds: number[],
): Promise<{ event_id: number; root_event_id: number }[]> {
  if (eventIds.length === 0) return [];
  return db("event_roots")
    .whereIn("event_id", eventIds)
    .select<{ event_id: number; root_event_id: number }[]>();
}

async function loadRootIds(eventId: number): Promise<number[]> {
  const roots = await db("event_roots")
    .where({ event_id: eventId })
    .select<{ root_event_id: number }[]>("root_event_id");
  return roots.map((r) => r.root_event_id);
}

function groupRootsByEvent(
  roots: { event_id: number; root_event_id: number }[],
): Map<number, number[]> {
  const byEvent = new Map<number, number[]>();
  for (const r of roots) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id)!.push(r.root_event_id);
  }
  return byEvent;
}

// ── Event operations (high-level: named calls) ────────────────────────────────

async function setEventRoots(eventId: number, rootIds: number[], userId: number): Promise<void> {
  const owned = (await ownedRootIds(rootIds, userId)).filter((id) => id !== eventId);
  await replaceRoots(eventId, owned);
}

async function findOrCreateDateEvent(date: string, userId: number, dbKey: Buffer): Promise<number> {
  const existing = await findDateEventId(date, userId, dbKey);
  if (existing !== undefined) return existing;
  const id = await insertEvent(userId, dbKey, {
    title: date,
    description: null,
    kind: "date",
    dateLookup: lookupToken(date, dbKey),
  });
  await linkDateParents(date, id, userId, dbKey);
  return id;
}

async function linkDateParents(
  date: string,
  eventId: number,
  userId: number,
  dbKey: Buffer,
): Promise<void> {
  const parents = dateParents(date);
  if (parents.length === 0) return;
  const parentId = await findOrCreateDateEvent(parents[0]!, userId, dbKey);
  await setEventRoots(eventId, [parentId], userId);
}

async function resolveRootIds(
  body: { root_event_ids?: number[]; date?: string },
  userId: number,
  dbKey: Buffer,
): Promise<number[]> {
  const rootIds = [...(body.root_event_ids ?? [])];
  if (body.date) rootIds.push(await findOrCreateDateEvent(normalizeDate(body.date), userId, dbKey));
  return rootIds;
}

async function loadEventsWithRoots(userId: number, dbKey: Buffer): Promise<EventWithRoots[]> {
  const events = await loadUserEvents(userId);
  const rootsByEvent = groupRootsByEvent(await loadRootsFor(events.map((e) => e.id)));
  return events.map((e) => ({
    ...decryptEvent(e, dbKey),
    root_event_ids: rootsByEvent.get(e.id) ?? [],
  }));
}

async function getEventWithRoots(
  id: number,
  userId: number,
  dbKey: Buffer,
): Promise<EventWithRoots | null> {
  const event = await findEvent(id, userId);
  if (!event) return null;
  return { ...decryptEvent(event, dbKey), root_event_ids: await loadRootIds(id) };
}

app.get("/api/events", async (c) => {
  const { userId, dbKey } = requireSession(c)!;
  return c.json(await loadEventsWithRoots(userId, dbKey));
});

app.post("/api/events", async (c) => {
  const { userId, dbKey } = requireSession(c)!;
  const body = await c.req.json<{
    title?: string;
    description?: string;
    root_event_ids?: number[];
    date?: string;
  }>();
  if (!body.title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (body.date !== undefined && body.date !== "" && !isValidDate(body.date))
    return c.json({ error: "Date must be a valid yyyy, yyyy-mm, or yyyy-mm-dd" }, 400);

  const eventId = await insertEvent(userId, dbKey, {
    title: body.title.trim(),
    description: body.description ?? null,
    kind: "event",
  });
  await setEventRoots(eventId, await resolveRootIds(body, userId, dbKey), userId);
  return c.json(await getEventWithRoots(eventId, userId, dbKey), 201);
});

app.patch("/api/events/:id", async (c) => {
  const { userId, dbKey } = requireSession(c)!;
  const id = Number(c.req.param("id"));
  const existing = await findEvent(id, userId);
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.kind === "date") return c.json({ error: "Date events cannot be edited" }, 400);
  const body = await c.req.json<{
    title?: string;
    description?: string;
    root_event_ids?: number[];
    date?: string;
  }>();
  if (body.title !== undefined && !body.title.trim())
    return c.json({ error: "Title is required" }, 400);
  if (body.date !== undefined && body.date !== "" && !isValidDate(body.date))
    return c.json({ error: "Date must be a valid yyyy, yyyy-mm, or yyyy-mm-dd" }, 400);

  await updateEventFields(id, userId, dbKey, {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
  });
  if (body.root_event_ids !== undefined || body.date !== undefined)
    await setEventRoots(id, await resolveRootIds(body, userId, dbKey), userId);

  return c.json(await getEventWithRoots(id, userId, dbKey));
});

app.delete("/api/events/:id", async (c) => {
  const { userId } = requireSession(c)!;
  const id = Number(c.req.param("id"));
  const deleted = await deleteEvent(id, userId);
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
