import { test, expect } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

async function testLogin(
  context: BrowserContext,
  username: string,
  passphrase = "correct-horse-battery-staple",
) {
  const res = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa("test:test")}`,
    },
    body: JSON.stringify({ username, passphrase }),
  });
  const cookie = res.headers.get("set-cookie");
  const [pair] = cookie?.split(";") ?? [];
  if (pair) {
    const [name, value] = pair.split("=");
    if (name && value) await context.addCookies([{ name, value, url: BASE_URL }]);
  }
  return res;
}

test("user can register (via test login) and land on the app", async ({ page, context }) => {
  await testLogin(context, "alice");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("logged-in user can log out and is redirected to auth", async ({ page, context }) => {
  await testLogin(context, "dave");
  await page.goto("/app");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL("/");
});

test("user with a different passphrase cannot decrypt another user's data", async ({ context }) => {
  await testLogin(context, "carol", "correct-horse-battery-staple");

  const res = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa("test:test")}`,
    },
    body: JSON.stringify({ username: "carol", passphrase: "wrong-passphrase" }),
  });
  expect(res.status).toBe(401);
});

test("registered user can log in again with the same passphrase", async ({ page, context }) => {
  await testLogin(context, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");

  // Log out
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  // Log in again
  await testLogin(context, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
});
