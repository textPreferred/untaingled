import { randomBytes } from "crypto";

interface Session {
  userId: number;
  dbKey: Buffer;
}

const sessions = new Map<string, Session>();

/**
 * Creates a new session ID for the given user and stores it in the sessions map.
 *
 * @param userId The ID of the user for whom to create the session.
 * @param dbKey The database key buffer associated with the session.
 * @returns The newly generated session ID as a hex string.
 */
export function createSession(userId: number, dbKey: Buffer): string {
  const id = randomBytes(32).toString("hex");
  sessions.set(id, { userId, dbKey });
  return id;
}

/**
 * Retrieves a session by its ID.
 *
 * @param id - The unique identifier of the session.
 * @returns The Session object if found; otherwise undefined.
 */
export function getSession(id: string): Session | undefined {
  return sessions.get(id);
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
