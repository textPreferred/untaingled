import { test, expect } from "@playwright/test";

type Page = import("@playwright/test").Page;

async function registerAndGoToApp(page: Page, username: string) {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL("/app");
}

const eventList = (page: Page) => page.getByRole("list");

async function addEvent(
  page: Page,
  title: string,
  options?: { description?: string; rootedIn?: string },
) {
  await page.getByLabel("Title").fill(title);
  if (options?.description) await page.getByLabel("Description").fill(options.description);
  if (options?.rootedIn)
    await page.getByLabel("Rooted in").selectOption({ label: options.rootedIn });
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText(title)).toBeVisible();
}

test("user can create an event with title only", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-title");

  await addEvent(page, "My first event");
});

test("user can create an event with a description", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-desc");

  await addEvent(page, "Event with description", { description: "Some details here" });

  await expect(eventList(page).getByText("Some details here")).toBeVisible();
});

test("user can create an event rooted in another", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-root");

  await addEvent(page, "Root event");
  await addEvent(page, "Child event", { rootedIn: "Root event" });
  await expect(eventList(page).getByText("Root event")).toHaveCount(2);
});

test("user can delete an event", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-delete");

  await addEvent(page, "Event to delete");

  await page
    .getByRole("listitem")
    .filter({ hasText: "Event to delete" })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(eventList(page).getByText("Event to delete")).not.toBeVisible();
});

test("graph view shows event nodes", async ({ page }) => {
  await registerAndGoToApp(page, "user-graph-nodes");

  await addEvent(page, "Alpha");
  await addEvent(page, "Beta");

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await expect(graph).toBeVisible();
  await expect(graph.getByText("Alpha")).toBeVisible();
  await expect(graph.getByText("Beta")).toBeVisible();
});

test("graph view shows edges between rooted events", async ({ page }) => {
  await registerAndGoToApp(page, "user-graph-edges");

  await addEvent(page, "Parent");
  await addEvent(page, "Child", { rootedIn: "Parent" });

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await expect(graph.getByText("Parent", { exact: true })).toBeVisible();
  await expect(graph.getByText("Child", { exact: true })).toBeVisible();

  const svg = graph.locator("svg");
  await expect(svg).toBeVisible();
  await expect(svg.locator("line.graph-edge")).not.toHaveCount(0);
});

test("deleting a root event clears the root reference on child events", async ({ page }) => {
  await registerAndGoToApp(page, "user-event-cascade");

  await addEvent(page, "Cascade root");
  await addEvent(page, "Cascade child", { rootedIn: "Cascade root" });

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
