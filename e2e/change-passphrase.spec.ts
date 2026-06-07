import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

async function testLogin(context: BrowserContext, username: string, passphrase: string) {
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

async function openChangePassphrase(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Change passphrase" }).click();
}

test("user can change passphrase and log in with the new one", async ({ page, context }) => {
  const oldPassphrase = "correct-horse-battery-staple";
  const newPassphrase = "trombone-mango-asteroid-velvet";

  await testLogin(context, "passphrase-changer", oldPassphrase);
  await page.goto("/app");
  await expect(page).toHaveURL("/app");

  await openChangePassphrase(page);

  await page.getByLabel("Current passphrase").fill(oldPassphrase);
  await page.getByLabel("New passphrase", { exact: true }).fill(newPassphrase);
  await page.getByLabel("Confirm new passphrase").fill(newPassphrase);

  const applyButton = page.getByRole("button", { name: "Apply change" });
  await expect(applyButton).toBeDisabled();

  await page.getByRole("button", { name: "Copy passphrase" }).click();

  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  const goodLogin = await testLogin(context, "passphrase-changer", newPassphrase);
  expect(goodLogin.status).toBe(200);

  const badLogin = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa("test:test")}`,
    },
    body: JSON.stringify({ username: "passphrase-changer", passphrase: oldPassphrase }),
  });
  expect(badLogin.status).toBe(401);
});

test("change passphrase form rejects wrong current passphrase", async ({ page, context }) => {
  const oldPassphrase = "correct-horse-battery-staple";
  await testLogin(context, "wrong-current", oldPassphrase);
  await page.goto("/app");

  await openChangePassphrase(page);

  await page.getByLabel("Current passphrase").fill("not-the-right-one");
  await page.getByLabel("New passphrase", { exact: true }).fill("some-new-passphrase");
  await page.getByLabel("Confirm new passphrase").fill("some-new-passphrase");
  await page.getByRole("button", { name: "Copy passphrase" }).click();
  await page.getByRole("button", { name: "Apply change" }).click();

  await expect(page.getByText(/wrong/i)).toBeVisible();

  const stillOldWorks = await testLogin(context, "wrong-current", oldPassphrase);
  expect(stillOldWorks.status).toBe(200);
});

test("apply is blocked until the new passphrase has been copied", async ({ page, context }) => {
  const oldPassphrase = "correct-horse-battery-staple";
  const newPassphrase = "never-copied-so-never-applied";

  await testLogin(context, "no-copy-no-change", oldPassphrase);
  await page.goto("/app");

  await openChangePassphrase(page);

  await page.getByLabel("Current passphrase").fill(oldPassphrase);
  await page.getByLabel("New passphrase", { exact: true }).fill(newPassphrase);
  await page.getByLabel("Confirm new passphrase").fill(newPassphrase);

  const applyButton = page.getByRole("button", { name: "Apply change" });
  await expect(applyButton).toBeDisabled();
  await applyButton.click({ force: true }).catch(() => {});

  const stillOldWorks = await testLogin(context, "no-copy-no-change", oldPassphrase);
  expect(stillOldWorks.status).toBe(200);

  const newDoesNotWork = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa("test:test")}`,
    },
    body: JSON.stringify({ username: "no-copy-no-change", passphrase: newPassphrase }),
  });
  expect(newDoesNotWork.status).toBe(401);
});

test("new passphrase input never exposes plaintext", async ({ page, context }) => {
  await testLogin(context, "no-plaintext", "correct-horse-battery-staple");
  await page.goto("/app");

  await openChangePassphrase(page);

  const newPassphraseInput = page.getByLabel("New passphrase", { exact: true });
  const confirmInput = page.getByLabel("Confirm new passphrase");

  await expect(newPassphraseInput).toHaveAttribute("type", "password");
  await expect(confirmInput).toHaveAttribute("type", "password");
});
