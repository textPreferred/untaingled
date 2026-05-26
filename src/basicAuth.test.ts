import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { basicAuth } from "./basicAuth";

function makeApp(user: string, password: string) {
  const app = new Hono();
  app.use("/*", basicAuth(user, password));
  app.get("/", (c) => c.text("ok"));
  return app;
}

describe("basicAuth middleware", () => {
  test("allows request with correct credentials", async () => {
    const app = makeApp("admin", "secret");
    const credentials = btoa("admin:secret");
    const res = await app.request("/", {
      headers: { Authorization: `Basic ${credentials}` },
    });
    expect(res.status).toBe(200);
  });

  test("rejects request with no credentials", async () => {
    const app = makeApp("admin", "secret");
    const res = await app.request("/");
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe('Basic realm="Untaingled"');
  });

  test("rejects request with wrong password", async () => {
    const app = makeApp("admin", "secret");
    const credentials = btoa("admin:wrong");
    const res = await app.request("/", {
      headers: { Authorization: `Basic ${credentials}` },
    });
    expect(res.status).toBe(401);
  });

  test("rejects request with wrong username", async () => {
    const app = makeApp("admin", "secret");
    const credentials = btoa("other:secret");
    const res = await app.request("/", {
      headers: { Authorization: `Basic ${credentials}` },
    });
    expect(res.status).toBe(401);
  });
});
