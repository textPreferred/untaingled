import type { Hono } from "hono";
import { isValidDate } from "../dateValidation";
import { requireSession } from "../middleware";
import {
  getEventWithRoots,
  loadEventsWithRoots,
  resolveRootIds,
  setEventRoots,
} from "../events/service";
import { deleteEvent, findEvent, insertEvent, updateEventFields } from "../events/repository";

type EventInput = {
  title?: string;
  description?: string;
  root_event_ids?: number[];
  date?: string;
};

const DATE_ERROR = "Date must be a valid yyyy, yyyy-mm, or yyyy-mm-dd";

// True when a supplied date is present and invalid. Empty/omitted dates pass —
// they mean "no date", handled by resolveRootIds.
function hasInvalidDate(date: string | undefined): boolean {
  return date !== undefined && date !== "" && !isValidDate(date);
}

// Registers the event CRUD endpoints. Must be mounted after the auth guard.
export function registerEventRoutes(app: Hono): void {
  app.get("/api/events", async (c) => {
    const { userId, dbKey } = requireSession(c)!;
    return c.json(await loadEventsWithRoots(userId, dbKey));
  });

  app.post("/api/events", async (c) => {
    const { userId, dbKey } = requireSession(c)!;
    const body = await c.req.json<EventInput>();
    if (!body.title?.trim()) return c.json({ error: "Title is required" }, 400);
    if (hasInvalidDate(body.date)) return c.json({ error: DATE_ERROR }, 400);

    const eventId = await insertEvent(userId, dbKey, {
      title: body.title.trim(),
      description: body.description ?? null,
      kind: "event",
    });
    await setEventRoots(eventId, await resolveRootIds(body, userId, dbKey), userId);
    return c.json(await getEventWithRoots(eventId, userId, dbKey), 201);
  });

  app.patch("/api/events/:id", async (c) => {
    const { userId, dbKey } = requireSession(c)!;
    const id = Number(c.req.param("id"));
    const existing = await findEvent(id, userId);
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.kind === "date") return c.json({ error: "Date events cannot be edited" }, 400);
    const body = await c.req.json<EventInput>();
    if (body.title !== undefined && !body.title.trim())
      return c.json({ error: "Title is required" }, 400);
    if (hasInvalidDate(body.date)) return c.json({ error: DATE_ERROR }, 400);

    await updateEventFields(id, userId, dbKey, {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
    if (body.root_event_ids !== undefined || body.date !== undefined)
      await setEventRoots(id, await resolveRootIds(body, userId, dbKey), userId);

    return c.json(await getEventWithRoots(id, userId, dbKey));
  });

  app.delete("/api/events/:id", async (c) => {
    const { userId } = requireSession(c)!;
    const id = Number(c.req.param("id"));
    const deleted = await deleteEvent(id, userId);
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.body(null, 204);
  });
}
