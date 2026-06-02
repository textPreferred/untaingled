import { test, expect } from "@playwright/test";
import type { Page, BrowserContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

async function loginAndGoToApp(page: Page, context: BrowserContext, username: string) {
  const res = await fetch(`${BASE_URL}/api/test/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa("test:test")}`,
    },
    body: JSON.stringify({ username, passphrase: "correct-horse-battery-staple" }),
  });
  const cookie = res.headers.get("set-cookie");
  if (cookie) {
    const [name, value] = cookie.split(";")[0]!.split("=");
    await context.addCookies([{ name, value, url: BASE_URL }]);
  }
  await page.goto("/app");
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
    await page.getByLabel("Took place while").selectOption({ label: options.rootedIn });
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(eventList(page).getByText(title)).toBeVisible();
}

test("user can create an event with title only", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-title");

  await addEvent(page, "My first event");
});

test("user can create an event with a description", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-desc");

  await addEvent(page, "Event with description", { description: "Some details here" });

  await expect(eventList(page).getByText("Some details here")).toBeVisible();
});

test("user can create an event rooted in another", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-root");

  await addEvent(page, "Root event");
  await addEvent(page, "Child event", { rootedIn: "Root event" });
  await expect(eventList(page).getByText("Root event")).toHaveCount(2);
});

test("user can delete an event", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-delete");

  await addEvent(page, "Event to delete");

  await page
    .getByRole("listitem")
    .filter({ hasText: "Event to delete" })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(eventList(page).getByText("Event to delete")).not.toBeVisible();
});

test("graph view shows event nodes", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-graph-nodes");

  await addEvent(page, "Alpha");
  await addEvent(page, "Beta");

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await expect(graph).toBeVisible();
  await expect(graph.getByText("Alpha")).toBeVisible();
  await expect(graph.getByText("Beta")).toBeVisible();
});

test("graph view shows edges between rooted events", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-graph-edges");

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

test("user can edit an event's title from the list", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-edit-title");

  await addEvent(page, "Original title");

  await page
    .getByRole("listitem")
    .filter({ hasText: "Original title" })
    .getByRole("button", { name: "Edit" })
    .click();

  await expect(page.getByLabel("Title")).toHaveValue("Original title");

  await page.getByLabel("Title").fill("Updated title");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(eventList(page).getByText("Updated title")).toBeVisible();
  await expect(eventList(page).getByText("Original title")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Add event" })).toBeVisible();
});

test("user can edit an event's description and rootedIn from the list", async ({
  page,
  context,
}) => {
  await loginAndGoToApp(page, context, "user-event-edit-desc-root");

  await addEvent(page, "Parent event");
  await addEvent(page, "Target event", { description: "Old description" });

  await page
    .getByRole("listitem")
    .filter({ has: page.getByRole("strong").filter({ hasText: /^Target event$/ }) })
    .getByRole("button", { name: "Edit" })
    .click();

  await expect(page.getByLabel("Description")).toHaveValue("Old description");

  await page.getByLabel("Description").fill("New description");
  await page.getByLabel("Took place while").selectOption({ label: "Parent event" });
  await page.getByRole("button", { name: "Save changes" }).click();

  const targetItem = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("strong").filter({ hasText: /^Target event$/ }) });
  await expect(targetItem.getByText("New description")).toBeVisible();
  await expect(targetItem.getByText("Took place while: Parent event")).toBeVisible();
});

test("user can cancel an edit", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-edit-cancel");

  await addEvent(page, "Keep me");

  await page
    .getByRole("listitem")
    .filter({ hasText: "Keep me" })
    .getByRole("button", { name: "Edit" })
    .click();

  await page.getByLabel("Title").fill("Changed in form");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(eventList(page).getByText("Keep me")).toBeVisible();
  await expect(eventList(page).getByText("Changed in form")).not.toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Add event" })).toBeVisible();
});

test("user can edit an event by clicking its node in the graph", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-edit-graph");

  await addEvent(page, "Graph original");

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await graph.getByText("Graph original").click();

  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Graph original");

  await page.getByLabel("Title", { exact: true }).fill("Graph updated");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(graph.getByText("Graph updated")).toBeVisible();
  await expect(graph.getByText("Graph original")).not.toBeVisible();
});

test("user can delete an event by clicking the delete button on its graph node", async ({
  page,
  context,
}) => {
  await loginAndGoToApp(page, context, "user-event-delete-graph");

  await addEvent(page, "Graph delete me");

  await page.getByRole("button", { name: "Graph" }).click();

  const graph = page.getByRole("region", { name: "Event graph" });
  await expect(graph.getByText("Graph delete me")).toBeVisible();

  await graph.getByRole("button", { name: "Delete Graph delete me" }).click();

  await expect(graph.getByText("Graph delete me")).not.toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Graph delete me" })).not.toBeVisible();
});

test("user can delete an event from the edit form", async ({ page, context }) => {
  await loginAndGoToApp(page, context, "user-event-delete-from-form");

  await addEvent(page, "Edit and delete me");

  await page
    .getByRole("listitem")
    .filter({ hasText: "Edit and delete me" })
    .getByRole("button", { name: "Edit" })
    .click();

  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Edit and delete me");

  await page.getByRole("button", { name: "Delete event" }).click();

  await expect(eventList(page).getByText("Edit and delete me")).not.toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Add event" })).toBeVisible();
});

test("deleting a root event clears the root reference on child events", async ({
  page,
  context,
}) => {
  await loginAndGoToApp(page, context, "user-event-cascade");

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
  await expect(childItem.getByText("Took place while:")).not.toBeVisible();
});
