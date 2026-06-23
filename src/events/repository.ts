import { db } from "../db";
import { decryptString, encryptString, lookupToken } from "../crypto";
import type { EventKind, EventRow } from "../types";

// Stored rows hold encrypted title/description; decryptEvent turns one into
// the plaintext API shape using the requester's per-user dbKey.
export type StoredEventRow = {
  id: number;
  title: string;
  description: string | null;
  kind: EventKind;
};

export function decryptEvent(row: StoredEventRow, dbKey: Buffer): EventRow {
  return {
    id: row.id,
    title: decryptString(row.title, dbKey),
    description: row.description === null ? null : decryptString(row.description, dbKey),
    kind: row.kind,
  };
}

export async function insertEvent(
  userId: number,
  dbKey: Buffer,
  fields: { title: string; description: string | null; kind: EventKind; dateLookup?: string },
): Promise<number> {
  const [created] = await db("events")
    .insert({
      title: encryptString(fields.title, dbKey),
      description: fields.description === null ? null : encryptString(fields.description, dbKey),
      kind: fields.kind,
      user_id: userId,
      ...(fields.dateLookup !== undefined ? { date_lookup: fields.dateLookup } : {}),
    })
    .returning<{ id: number }[]>(["id"]);
  if (!created) throw new Error("Failed to create event");
  return created.id;
}

export async function updateEventFields(
  id: number,
  userId: number,
  dbKey: Buffer,
  fields: { title?: string; description?: string | null },
): Promise<void> {
  const patch: { title?: string; description?: string | null } = {};
  if (fields.title !== undefined) patch.title = encryptString(fields.title, dbKey);
  if (fields.description !== undefined)
    patch.description =
      fields.description === null ? null : encryptString(fields.description, dbKey);
  await db("events").where({ id, user_id: userId }).update(patch);
}

export async function findEvent(id: number, userId: number): Promise<StoredEventRow | undefined> {
  return db("events").where({ id, user_id: userId }).first<StoredEventRow>();
}

export async function findDateEventId(
  date: string,
  userId: number,
  dbKey: Buffer,
): Promise<number | undefined> {
  const existing = await db("events")
    .where({ kind: "date", user_id: userId, date_lookup: lookupToken(date, dbKey) })
    .first<{ id: number }>();
  return existing?.id;
}

export async function deleteEvent(id: number, userId: number): Promise<number> {
  return db("events").where({ id, user_id: userId }).delete();
}

// Keep only root ids the user owns — blocks cross-user links (IDOR via roots).
export async function ownedRootIds(rootIds: number[], userId: number): Promise<number[]> {
  const unique = [...new Set(rootIds)];
  if (unique.length === 0) return [];
  const owned = await db("events")
    .whereIn("id", unique)
    .where({ user_id: userId })
    .select<{ id: number }[]>("id");
  return owned.map((e) => e.id);
}

export async function replaceRoots(eventId: number, rootIds: number[]): Promise<void> {
  await db("event_roots").where({ event_id: eventId }).delete();
  if (rootIds.length > 0) {
    await db("event_roots").insert(
      rootIds.map((root_event_id) => ({ event_id: eventId, root_event_id })),
    );
  }
}

export async function loadUserEvents(userId: number): Promise<StoredEventRow[]> {
  return db("events").where({ user_id: userId }).select<StoredEventRow[]>();
}

export async function loadRootsFor(
  eventIds: number[],
): Promise<{ event_id: number; root_event_id: number }[]> {
  if (eventIds.length === 0) return [];
  return db("event_roots")
    .whereIn("event_id", eventIds)
    .select<{ event_id: number; root_event_id: number }[]>();
}

export async function loadRootIds(eventId: number): Promise<number[]> {
  const roots = await db("event_roots")
    .where({ event_id: eventId })
    .select<{ root_event_id: number }[]>("root_event_id");
  return roots.map((r) => r.root_event_id);
}

export function groupRootsByEvent(
  roots: { event_id: number; root_event_id: number }[],
): Map<number, number[]> {
  const byEvent = new Map<number, number[]>();
  for (const r of roots) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id)!.push(r.root_event_id);
  }
  return byEvent;
}
