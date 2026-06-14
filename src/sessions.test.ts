import { describe, test, expect } from "bun:test";
import { createSession, getSession, deleteSession, SESSION_TTL_MS } from "./sessions";

const key = () => Buffer.alloc(32, 7);

describe("session lifecycle", () => {
  test("a fresh session resolves to its user and key", () => {
    const id = createSession(42, key());
    const s = getSession(id);
    expect(s?.userId).toBe(42);
    expect(s?.dbKey.equals(key())).toBe(true);
  });

  test("an unknown id resolves to undefined", () => {
    expect(getSession("nope")).toBeUndefined();
  });

  test("a deleted session resolves to undefined", () => {
    const id = createSession(1, key());
    deleteSession(id);
    expect(getSession(id)).toBeUndefined();
  });

  test("a session past its TTL resolves to undefined", () => {
    const id = createSession(1, key());
    expect(getSession(id)).toBeDefined();
    expect(getSession(id, Date.now() + SESSION_TTL_MS + 1)).toBeUndefined();
  });

  test("an expired session is purged, not just hidden", () => {
    const id = createSession(1, key());
    // read past expiry purges it; a subsequent read at 'now' also misses
    getSession(id, Date.now() + SESSION_TTL_MS + 1);
    expect(getSession(id)).toBeUndefined();
  });
});
