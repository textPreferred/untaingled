import { CURRENT_KDF_PARAMS, serializeKdfParams } from "./crypto";

export const IS_TEST = process.env["NODE_ENV"] === "test";
export const IS_PROD = process.env["NODE_ENV"] === "production";

// Shared cookie hardening: HttpOnly + SameSite=Lax always; Secure in prod
// (omitted in dev/test so cookies work over plain http://localhost).
export const SESSION_COOKIE = {
  httpOnly: true,
  path: "/",
  sameSite: "Lax",
  secure: IS_PROD,
} as const;

export const AUTH0_DOMAIN = process.env["AUTH0_DOMAIN"] ?? "";
export const AUTH0_CLIENT_ID = process.env["AUTH0_CLIENT_ID"] ?? "";
export const AUTH0_CLIENT_SECRET = process.env["AUTH0_CLIENT_SECRET"] ?? "";
export const AUTH0_CALLBACK_URL = process.env["AUTH0_CALLBACK_URL"] ?? "";

// Half-finished logins must not accumulate forever, so every pending entry
// carries an expiry and stale ones are swept periodically.
export const PENDING_TTL_MS = 10 * 60 * 1000; // 10 min (matches the pending_auth cookie)

export const CURRENT_KDF_PARAMS_SERIALIZED = serializeKdfParams(CURRENT_KDF_PARAMS);
