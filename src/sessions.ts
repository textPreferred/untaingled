import { randomBytes } from "crypto";

interface Session {
  userId: number;
  dbKey: Buffer;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

/** Absolute lifetime of a session before it must be re-established. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** How often expired sessions are swept from memory. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Creates a new session ID for the given user and stores it in the sessions map.
 *
 * @param userId The ID of the user for whom to create the session.
 * @param dbKey The database key buffer associated with the session.
 * @returns The newly generated session ID as a hex string.
 */
export function createSession(userId: number, dbKey: Buffer): string {
  const id = randomBytes(32).toString("hex");
  sessions.set(id, { userId, dbKey, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

/**
 * Retrieves a session by its ID, treating expired sessions as absent and
 * purging them on access.
 *
 * @param id - The unique identifier of the session.
 * @param now - The current time in ms (injectable for testing).
 * @returns The Session if found and unexpired; otherwise undefined.
 */
export function getSession(id: string, now: number = Date.now()): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (session.expiresAt <= now) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

/**
 * Deletes a session with the given ID.
 *
 * @param id - The identifier of the session to delete.
 * @returns void
 */
export function deleteSession(id: string): void {
  sessions.delete(id);
}

// Periodically purge expired sessions so the map can't grow without bound.
// unref() so the timer never keeps the process (or test runner) alive.
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}, SWEEP_INTERVAL_MS).unref();
