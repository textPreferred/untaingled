import { test, expect } from "@playwright/test";

test("user can create an event with a title, add it and see it in the list", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Event title").fill("My first event");
  await page.getByRole("button", { name: "Add event" }).click();

  await expect(page.getByText("My first event")).toBeVisible();
});
