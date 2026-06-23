import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test("health check returns 200 without auth", async () => {
  const res = await fetch(`${BASE_URL}/health`);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("OK");
});
