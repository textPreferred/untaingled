import { test, expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";

async function testLogin(
  page: Page,
  request: APIRequestContext,
  username: string,
  passphrase = "correct-horse-battery-staple",
) {
  const res = await request.post("/api/test/login", { data: { username, passphrase } });
  const cookie = res.headers()["set-cookie"];
  if (cookie) {
    const [name, value] = cookie.split(";")[0]!.split("=") as [string, string];
    await page.context().addCookies([{ name, value, url: "http://localhost:3000" }]);
  }
  return res;
}

test("user can register (via test login) and land on the app", async ({ page, request }) => {
  await testLogin(page, request, "alice");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("logged-in user can log out and is redirected to auth", async ({ page, request }) => {
  await testLogin(page, request, "dave");
  await page.goto("/app");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL("/");
});

test("user with a different passphrase cannot decrypt another user's data", async ({
  page,
  request,
}) => {
  await testLogin(page, request, "carol", "correct-horse-battery-staple");

  const res = await request.post("/api/test/login", {
    data: { username: "carol", passphrase: "wrong-passphrase" },
  });
  expect(res.status()).toBe(401);
});

test("registered user can log in again with the same passphrase", async ({ page, request }) => {
  await testLogin(page, request, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");

  // Log out
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  // Log in again
  await testLogin(page, request, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
});
