import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import * as oidc from "openid-client";
import { db } from "../db";
import { createSession, deleteSession } from "../sessions";
import {
  CURRENT_KDF_PARAMS,
  decryptDbKey,
  deriveKey,
  encryptDbKey,
  generateDbKey,
  generateSalt,
  parseKdfParams,
} from "../crypto";
import {
  AUTH0_CALLBACK_URL,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  AUTH0_DOMAIN,
  CURRENT_KDF_PARAMS_SERIALIZED,
  IS_TEST,
  PENDING_TTL_MS,
  SESSION_COOKIE,
} from "../config";
import { requireSession } from "../middleware";
import { makeTempToken, pendingAuth, pendingPassphrase, takeFresh } from "../auth/pendingStore";
import {
  changePassphrase,
  createUserWithPassphrase,
  loginReturningUser,
  migrateLegacyUser,
  upgradeKdfParams,
} from "../auth/accounts";
import type { UserRow } from "../types";

type TestLoginRequest = { username: string; passphrase: string };
type PassphraseRequest = { passphrase: string; username?: string };
type ChangePassphraseRequest = { currentPassphrase?: string; newPassphrase?: string };

const oidcConfig = IS_TEST
  ? null
  : await oidc.discovery(new URL(`https://${AUTH0_DOMAIN}`), AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET);

// Registers test login (test env only), the Auth0 login/callback handshake,
// passphrase submission, change-passphrase, and logout. Must be mounted after
// the CSRF guard but before the auth guard — the passphrase routes run before a
// session exists.
export function registerAuthRoutes(app: Hono): void {
  // ── Test-only login endpoint (bypasses Auth0) ───────────────────────────────
  if (IS_TEST) {
    app.post("/api/test/login", async (c) => {
      const { username, passphrase } = await c.req.json<TestLoginRequest>();

      const user = (await db("users").where({ username }).first()) as UserRow | undefined;
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
          .returning(["id"]);
        const sessionId = createSession(created.id as number, dbKey);
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

  // ── Auth0 login initiation ──────────────────────────────────────────────────
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

  // ── Auth0 callback ──
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

  // ── Passphrase submission ──
  app.post("/api/auth/passphrase", async (c) => {
    const tempToken = getCookie(c, "pending_auth");
    if (!tempToken) return c.json({ error: "Session expired" }, 401);

    const pending = takeFresh(pendingPassphrase, tempToken);
    if (!pending) return c.json({ error: "Session expired" }, 401);

    const { passphrase, username: legacyUsername } = await c.req.json<PassphraseRequest>();
    if (!passphrase) return c.json({ error: "Passphrase required" }, 400);

    let result;
    if (pending.isNewUser) {
      result = await createUserWithPassphrase(pending.auth0Sub, passphrase);
    } else if (pending.needsMigration) {
      if (!legacyUsername) return c.json({ error: "Username required for migration" }, 400);
      result = await migrateLegacyUser(pending.auth0Sub, legacyUsername, passphrase);
    } else {
      result = await loginReturningUser(pending, passphrase);
    }
    if (!result.ok) return c.json({ error: result.error }, result.status);

    pendingPassphrase.delete(tempToken);
    deleteCookie(c, "pending_auth", { path: "/" });

    const sessionId = createSession(result.userId, result.dbKey);
    setCookie(c, "session", sessionId, SESSION_COOKIE);
    return c.json({ ok: true });
  });

  // ── Change passphrase ──
  app.post("/api/auth/change-passphrase", async (c) => {
    const session = requireSession(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const { currentPassphrase, newPassphrase } = await c.req.json<ChangePassphraseRequest>();
    if (!currentPassphrase || !newPassphrase)
      return c.json({ error: "Both passphrases required" }, 400);

    const result = await changePassphrase(
      session.userId,
      session.dbKey,
      currentPassphrase,
      newPassphrase,
    );
    if (!result.ok) return c.json({ error: result.error }, result.status);

    return c.body(null, 204);
  });

  // ── Logout ──
  app.post("/api/logout", (c) => {
    const sessionId = getCookie(c, "session");
    if (sessionId) deleteSession(sessionId);
    deleteCookie(c, "session", { path: "/" });
    return c.body(null, 204);
  });
}
