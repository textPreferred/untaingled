import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

async function testLogin(
  context: BrowserContext,
  request: APIRequestContext,
  username: string,
  passphrase = "correct-horse-battery-staple",
) {
  const res = await request.post(`${BASE_URL}/api/test/login`, { data: { username, passphrase } });
  const cookie = res.headers()["set-cookie"];
  if (cookie) {
    const [name, value] = cookie.split(";")[0]!.split("=");
    await context.addCookies([{ name, value, url: BASE_URL }]);
  }
  return res;
}

test("user can register (via test login) and land on the app", async ({
  page,
  request,
  context,
}) => {
  await testLogin(context, request, "alice");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("logged-in user can log out and is redirected to auth", async ({ page, request, context }) => {
  await testLogin(context, request, "dave");
  await page.goto("/app");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL("/");
});

test("user with a different passphrase cannot decrypt another user's data", async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/test/login`, {
    data: { username: "carol", passphrase: "correct-horse-battery-staple" },
  });
  expect(res.ok()).toBe(true);

  const res2 = await request.post(`${BASE_URL}/api/test/login`, {
    data: { username: "carol", passphrase: "wrong-passphrase" },
  });
  expect(res2.status()).toBe(401);
});

test("registered user can log in again with the same passphrase", async ({
  page,
  request,
  context,
}) => {
  await testLogin(context, request, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");

  // Log out
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  // Log in again
  await testLogin(context, request, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
});
