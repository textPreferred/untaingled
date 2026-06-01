import { test, expect } from "@playwright/test";

async function testLogin(
  request: import("@playwright/test").APIRequestContext,
  username: string,
  passphrase = "correct-horse-battery-staple",
) {
  return request.post("http://localhost:3000/api/test/login", { data: { username, passphrase } });
}

test("user can register (via test login) and land on the app", async ({ page, request }) => {
  await testLogin(request, "alice");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("logged-in user can log out and is redirected to auth", async ({ page, request }) => {
  await testLogin(request, "dave");
  await page.goto("/app");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL("/");
});

test("user with a different passphrase cannot decrypt another user's data", async ({ request }) => {
  await testLogin(request, "carol", "correct-horse-battery-staple");

  const res = await request.post("http://localhost:3000/api/test/login", {
    data: { username: "carol", passphrase: "wrong-passphrase" },
  });
  expect(res.status()).toBe(401);
});

test("registered user can log in again with the same passphrase", async ({ page, request }) => {
  await testLogin(request, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");

  // Log out
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  // Log in again
  await testLogin(request, "bob");
  await page.goto("/app");
  await expect(page).toHaveURL("/app");
});
