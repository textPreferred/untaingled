import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const AUTH = `Basic ${btoa("test:test")}`;

type EventRow = { id: number; title: string };

async function loginGetSessionCookie(username: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ username, passphrase: "correct-horse-battery-staple" }),
  });
  expect(res.ok).toBe(true);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const session = setCookie.split(";")[0] ?? "";
  expect(session.startsWith("session=")).toBe(true);
  return session;
}

function api(path: string, cookie: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: AUTH,
      cookie,
      ...init?.headers,
    },
  });
}

async function createEvent(cookie: string, title: string): Promise<EventRow> {
  const res = await api("/api/events", cookie, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as EventRow;
}

test("a user cannot read another user's events", async () => {
  const alice = await loginGetSessionCookie("iso-alice-read");
  const bob = await loginGetSessionCookie("iso-bob-read");

  const secret = await createEvent(alice, "Alice private event");

  const bobEvents = (await (await api("/api/events", bob)).json()) as EventRow[];
  expect(bobEvents.some((e) => e.id === secret.id)).toBe(false);
  expect(bobEvents.some((e) => e.title === "Alice private event")).toBe(false);
});

test("a user cannot edit or delete another user's event", async () => {
  const alice = await loginGetSessionCookie("iso-alice-write");
  const bob = await loginGetSessionCookie("iso-bob-write");

  const owned = await createEvent(alice, "Alice owned event");

  const patch = await api(`/api/events/${owned.id}`, bob, {
    method: "PATCH",
    body: JSON.stringify({ title: "hijacked" }),
  });
  expect(patch.status).toBe(404);

  const del = await api(`/api/events/${owned.id}`, bob, { method: "DELETE" });
  expect(del.status).toBe(404);

  const aliceEvents = (await (await api("/api/events", alice)).json()) as EventRow[];
  expect(aliceEvents.find((e) => e.id === owned.id)?.title).toBe("Alice owned event");
});
