import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const AUTH = `Basic ${btoa("test:test")}`;

async function login(username: string): Promise<{ cookie: string; setCookie: string }> {
  const res = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ username, passphrase: "correct-horse-battery-staple" }),
  });
  expect(res.ok).toBe(true);
  const setCookie = res.headers.get("set-cookie") ?? "";
  return { cookie: setCookie.split(";")[0] ?? "", setCookie };
}

function post(cookie: string, headers: Record<string, string>) {
  return fetch(`${BASE_URL}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH, cookie, ...headers },
    body: JSON.stringify({ title: "csrf test" }),
  });
}

test("session cookie is HttpOnly and SameSite=Lax", async () => {
  const { setCookie } = await login("csrf-cookie-flags");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie.toLowerCase()).toContain("samesite=lax");
});

test("rejects a mutating request from a foreign origin", async () => {
  const { cookie } = await login("csrf-foreign");
  const res = await post(cookie, { origin: "https://evil.example.com" });
  expect(res.status).toBe(403);
});

test("allows a mutating request from the same origin", async () => {
  const { cookie } = await login("csrf-same");
  const res = await post(cookie, { origin: BASE_URL });
  expect(res.status).toBe(201);
});
