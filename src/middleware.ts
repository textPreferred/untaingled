import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getSession } from "./sessions";

export function requireSession(c: Context): { userId: number; dbKey: Buffer } | null {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return null;
  return getSession(sessionId) ?? null;
}

// ── CSRF guard ──────────────────────────────────────────────────────────────
// Browsers send Origin on cross-site state-changing requests; reject those
// whose Origin host doesn't match the request Host. Header-less clients
// (curl, server-to-server) aren't a CSRF vector, so they pass. Pairs with the
// SameSite=Lax session cookie as defense-in-depth.
export const csrfGuard: MiddlewareHandler = async (c, next) => {
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
};

// Rejects unauthenticated API requests. The passphrase-submission endpoint is
// exempt because it runs before a session exists.
export const authGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.path === "/api/auth/passphrase") return next();
  if (!requireSession(c)) return c.json({ error: "Unauthorized" }, 401);
  return next();
};
