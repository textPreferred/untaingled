import { test, expect } from "@playwright/test";

test("user can register and land on the app", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page).toHaveURL("/app");
});

test("registered user can log in and land on the app", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Username").fill("bob");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL("/app");

  await page.goto("/");
  await page.getByLabel("Username").fill("bob");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL("/app");
});
