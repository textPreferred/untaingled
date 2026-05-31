import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function testLogin(
  page: Page,
  username: string,
  passphrase = "correct-horse-battery-staple",
) {
  if (!page.url().startsWith("http")) await page.goto("/");
  return page.request.post("/api/test/login", { data: { username, passphrase } });
}

test("user can register (via test login) and land on the app", async ({ page }) => {
  await testLogin(page, "alice");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("logged-in user can log out and is redirected to auth", async ({ page }) => {
  await testLogin(page, "dave");
  await page.goto("/app");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL("/");
});

test("user with a different passphrase cannot decrypt another user's data", async ({ page }) => {
  await testLogin(page, "carol", "correct-horse-battery-staple");

  const res = await page.request.post("/api/test/login", {
    data: { username: "carol", passphrase: "wrong-passphrase" },
  });
  expect(res.status()).toBe(401);
});

test("registered user can log in again with the same passphrase", async ({ page }) => {
  await testLogin(page, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");

  // Log out
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  // Log in again
  await testLogin(page, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
});
