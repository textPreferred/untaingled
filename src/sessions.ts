import { randomBytes } from "crypto";

interface Session {
  userId: number;
  dbKey: Buffer;
}

const sessions = new Map<string, Session>();

export function createSession(userId: number, dbKey: Buffer): string {
  const id = randomBytes(32).toString("hex");
  sessions.set(id, { userId, dbKey });
  return id;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}
