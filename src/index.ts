import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { Database } from "bun:sqlite";

const db = new Database("data.db");

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL
  )
`);

const app = new Hono();

app.get("/api/events", (c) => {
  const events = db.query("SELECT id, title FROM events").all();
  return c.json(events);
});

app.post("/api/events", async (c) => {
  const { title } = await c.req.json<{ title: string }>();
  const insert = db.query("INSERT INTO events (title) VALUES (?) RETURNING id, title");
  const result = insert.get(title) as { id: number; title: string };
  return c.json(result, 201);
});

app.use("/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ path: "./dist/client/index.html" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
