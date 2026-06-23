import { PENDING_TTL_MS } from "../config";

// Pending OIDC states: state → { codeVerifier, nonce }
export const pendingAuth = new Map<
  string,
  { codeVerifier: string; nonce: string; expiresAt: number }
>();

// Pending passphrase sessions: tempToken → account context awaiting a passphrase.
export type PendingPassphrase = {
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

export const pendingPassphrase = new Map<string, PendingPassphrase>();

export function makeTempToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
}

// Reads an entry only if it hasn't expired, purging it on access either way.
export function takeFresh<T extends { expiresAt: number }>(
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

// Periodically drops expired pending entries so the maps don't grow unbounded.
export function startPendingSweep(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of pendingAuth) if (v.expiresAt <= now) pendingAuth.delete(k);
    for (const [k, v] of pendingPassphrase) if (v.expiresAt <= now) pendingPassphrase.delete(k);
  }, PENDING_TTL_MS).unref();
}
