import { lookupToken } from "../crypto";
import { dateParents, normalizeDate } from "../dateValidation";
import type { EventWithRoots } from "../types";
import {
  decryptEvent,
  findDateEventId,
  findEvent,
  groupRootsByEvent,
  insertEvent,
  loadRootIds,
  loadRootsFor,
  loadUserEvents,
  ownedRootIds,
  replaceRoots,
} from "./repository";

export async function setEventRoots(
  eventId: number,
  rootIds: number[],
  userId: number,
): Promise<void> {
  const owned = (await ownedRootIds(rootIds, userId)).filter((id) => id !== eventId);
  await replaceRoots(eventId, owned);
}

export async function findOrCreateDateEvent(
  date: string,
  userId: number,
  dbKey: Buffer,
): Promise<number> {
  const existing = await findDateEventId(date, userId, dbKey);
  if (existing !== undefined) return existing;
  const id = await insertEvent(userId, dbKey, {
    title: date,
    description: null,
    kind: "date",
    dateLookup: lookupToken(date, dbKey),
  });
  await linkDateParents(date, id, userId, dbKey);
  return id;
}

async function linkDateParents(
  date: string,
  eventId: number,
  userId: number,
  dbKey: Buffer,
): Promise<void> {
  const parents = dateParents(date);
  if (parents.length === 0) return;
  const parentId = await findOrCreateDateEvent(parents[0]!, userId, dbKey);
  await setEventRoots(eventId, [parentId], userId);
}

export async function resolveRootIds(
  body: { root_event_ids?: number[]; date?: string },
  userId: number,
  dbKey: Buffer,
): Promise<number[]> {
  const rootIds = [...(body.root_event_ids ?? [])];
  if (body.date) rootIds.push(await findOrCreateDateEvent(normalizeDate(body.date), userId, dbKey));
  return rootIds;
}

export async function loadEventsWithRoots(
  userId: number,
  dbKey: Buffer,
): Promise<EventWithRoots[]> {
  const events = await loadUserEvents(userId);
  const rootsByEvent = groupRootsByEvent(await loadRootsFor(events.map((e) => e.id)));
  return events.map((e) => ({
    ...decryptEvent(e, dbKey),
    root_event_ids: rootsByEvent.get(e.id) ?? [],
  }));
}

export async function getEventWithRoots(
  id: number,
  userId: number,
  dbKey: Buffer,
): Promise<EventWithRoots | null> {
  const event = await findEvent(id, userId);
  if (!event) return null;
  return { ...decryptEvent(event, dbKey), root_event_ids: await loadRootIds(id) };
}
