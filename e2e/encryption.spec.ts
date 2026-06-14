import { test, expect } from "@playwright/test";
import knex from "knex";

const BASE_URL = "http://localhost:3000";
const AUTH = `Basic ${btoa("test:test")}`;

const dbConn = () => knex({ client: "pg", connection: process.env["DATABASE_URL"] });

type EventRow = { id: number; title: string; description: string | null };

async function login(username: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ username, passphrase: "correct-horse-battery-staple" }),
  });
  expect(res.ok).toBe(true);
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

function api(path: string, cookie: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: AUTH, cookie, ...init?.headers },
  });
}

async function createEvent(
  cookie: string,
  body: { title: string; description?: string; date?: string },
): Promise<EventRow> {
  const res = await api("/api/events", cookie, { method: "POST", body: JSON.stringify(body) });
  expect(res.status).toBe(201);
  return (await res.json()) as EventRow;
}

test("event title and description are stored encrypted, returned decrypted", async () => {
  const cookie = await login("enc-content");
  const created = await createEvent(cookie, {
    title: "Top secret meeting",
    description: "classified notes",
  });

  const db = dbConn();
  try {
    const row = (await db("events").where({ id: created.id }).first()) as EventRow;
    expect(row.title).not.toBe("Top secret meeting");
    expect(row.description).not.toBe("classified notes");
    expect(row.title).toMatch(/^[0-9a-f]+$/);
    expect(row.description).toMatch(/^[0-9a-f]+$/);
  } finally {
    await db.destroy();
  }

  const list = (await (await api("/api/events", cookie)).json()) as EventRow[];
  const back = list.find((e) => e.id === created.id);
  expect(back?.title).toBe("Top secret meeting");
  expect(back?.description).toBe("classified notes");
});

test("date event titles are encrypted at rest but still dedup per user", async () => {
  const cookie = await login("enc-date");
  await createEvent(cookie, { title: "First", date: "1999" });
  await createEvent(cookie, { title: "Second", date: "1999" });

  const db = dbConn();
  try {
    const dateTitles = (await db("events").where({ kind: "date" }).select("title")) as {
      title: string;
    }[];
    expect(dateTitles.some((r) => r.title === "1999")).toBe(false);
  } finally {
    await db.destroy();
  }

  const list = (await (await api("/api/events", cookie)).json()) as EventRow[];
  expect(list.filter((e) => e.title === "1999")).toHaveLength(1);
});
