import { test, expect } from "@playwright/test";

async function registerAndGoToApp(page: import("@playwright/test").Page, username: string) {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL("/app");
}

const eventList = (page: import("@playwright/test").Page) => page.getByRole("list");

test("user can create an event with title only", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-title");

  await page.getByLabel("Title").fill("My first event");
  await page.getByRole("button", { name: "Add event" }).click();

  await expect(eventList(page).getByText("My first event")).toBeVisible();
});

test("user can create an event with a description", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-desc");

  await page.getByLabel("Title").fill("Event with description");
  await page.getByLabel("Description").fill("Some details here");
  await page.getByRole("button", { name: "Add event" }).click();

  await expect(eventList(page).getByText("Event with description")).toBeVisible();
  await expect(eventList(page).getByText("Some details here")).toBeVisible();
});

test("user can create an event rooted in another", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-root");

  await page.getByLabel("Title").fill("Root event");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText("Root event")).toBeVisible();

  await page.getByLabel("Title").fill("Child event");
  await page.getByLabel("Rooted in").selectOption({ label: "Root event" });
  await page.getByRole("button", { name: "Add event" }).click();

  await expect(eventList(page).getByText("Child event")).toBeVisible();
  await expect(eventList(page).getByText("Root event")).toHaveCount(2);
});

test("user can delete an event", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-delete");

  await page.getByLabel("Title").fill("Event to delete");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText("Event to delete")).toBeVisible();

  await page
    .getByRole("listitem")
    .filter({ hasText: "Event to delete" })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(eventList(page).getByText("Event to delete")).not.toBeVisible();
});

test("graph view shows event nodes", async ({ page }) => {
  await registerAndGoToApp(page, "user-graph-nodes");

  await page.getByLabel("Title").fill("Alpha");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText("Alpha")).toBeVisible();

  await page.getByLabel("Title").fill("Beta");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText("Beta")).toBeVisible();

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await expect(graph).toBeVisible();
  await expect(graph.getByText("Alpha")).toBeVisible();
  await expect(graph.getByText("Beta")).toBeVisible();
});

test("graph view shows edges between rooted events", async ({ page }) => {
  await registerAndGoToApp(page, "user-graph-edges");

  await page.getByLabel("Title").fill("Parent");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText("Parent")).toBeVisible();

  await page.getByLabel("Title").fill("Child");
  await page.getByLabel("Rooted in").selectOption({ label: "Parent" });
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText("Child")).toBeVisible();

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await expect(graph.getByText("Parent")).toBeVisible();
  await expect(graph.getByText("Child")).toBeVisible();

  const svg = graph.locator("svg");
  await expect(svg).toBeVisible();
  await expect(svg.locator("line, path[class*='edge'], polyline").first()).toBeVisible();
});

test("deleting a root event clears the root reference on child events", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-cascade");

  await page.getByLabel("Title").fill("Cascade root");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(
    eventList(page).getByRole("strong").filter({ hasText: "Cascade root" }),
  ).toBeVisible();

  await page.getByLabel("Title").fill("Cascade child");
  await page.getByLabel("Rooted in").selectOption({ label: "Cascade root" });
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(
    eventList(page).getByRole("strong").filter({ hasText: "Cascade child" }),
  ).toBeVisible();

  await page
    .getByRole("listitem")
    .filter({ has: page.getByRole("strong").filter({ hasText: /^Cascade root$/ }) })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    eventList(page).getByRole("strong").filter({ hasText: "Cascade root" }),
  ).not.toBeVisible();

  const childItem = page.getByRole("listitem").filter({ hasText: "Cascade child" });
  await expect(childItem).toBeVisible();
  await expect(childItem.getByText("Rooted in:")).not.toBeVisible();
});
