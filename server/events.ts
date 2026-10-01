import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { communityEvents as events, communities, eventRsvps, profiles } from "./db/schema";
import type { Transaction } from "./db/client";
import type { CommunityEvent, ResourcePage } from "../shared/types";
import { HttpError, text, uuid } from "./validation";
import { enumValue, externalHttps, utcDate, versionValue } from "./content-validation";
import { scopedCursor, nextScopedCursor } from "./scoped-cursor";
const fields = (userId: string) => ({ ...getTableColumns(events), createdAt: sql<string>`to_char(${events.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, publisher: profiles, community: communities, rsvped: sql<boolean>`exists(select 1 from event_rsvps r where r.event_id=${events.id} and r.user_id=${userId})` });
const eventQuery = (tx: Transaction, userId: string) => tx.select(fields(userId)).from(events).innerJoin(profiles, eq(profiles.id, events.ownerId)).innerJoin(communities, eq(communities.id, events.communityId));
export async function readEvent(tx: Transaction, userId: string, id: string): Promise<CommunityEvent> {
  const [row] = await eventQuery(tx, userId).where(eq(events.id, id));
  if (!row) throw new HttpError(404, "Etkinlik bulunamadı veya topluluğun üyesi değilsin.");
  return row;
}
export async function listEvents(tx: Transaction, userId: string, params: URLSearchParams): Promise<ResourcePage<CommunityEvent>> {
  const period = enumValue(params.get("period") || "upcoming", ["upcoming", "past"]), communityId = params.get("communityId") ? uuid(params.get("communityId")) : null;
  const scope = JSON.stringify([userId, period, communityId]), cursor = scopedCursor(params.get("cursor"), scope);
  const rows = await eventQuery(tx, userId).where(and(communityId ? eq(events.communityId, communityId) : undefined, period === "past" ? sql`${events.startsAt}<=now()` : sql`${events.startsAt}>now()`, cursor ? sql`(${events.createdAt},${events.id})<(${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : undefined)).orderBy(desc(events.createdAt), desc(events.id)).limit(21);
  const items = rows.slice(0, 20), last = items.at(-1);
  return { items, nextCursor: rows.length > 20 && last ? nextScopedCursor(scope, last) : null };
}
export async function saveEvent(tx: Transaction, userId: string, body: Record<string, unknown>, id?: string): Promise<CommunityEvent> {
  const startsAt = utcDate(body.startsAt)!, endsAt = utcDate(body.endsAt, true);
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new HttpError(400, "Bitiş, başlangıçtan sonra olmalı.");
  const values = { title: text(body.title, 1, 120), description: text(body.description ?? "", 0, 2000), startsAt, endsAt, meetingUrl: externalHttps(body.meetingUrl, true) };
  let row;
  if (id) {
    const old = await readEvent(tx, userId, id);
    if (old.ownerId !== userId) throw new HttpError(404, "Etkinlik bulunamadı.");
    const status = enumValue(body.status, ["active", "cancelled"]);
    if (body.communityId && body.communityId !== old.communityId) throw new HttpError(400, "Etkinliğin topluluğu değiştirilemez.");
    if (old.status === "cancelled" && status !== "cancelled") throw new HttpError(400, "İptal edilen etkinlik yeniden açılamaz.");
    if (Date.parse(startsAt) <= Date.now() && !(status === "cancelled" && Date.parse(startsAt) === Date.parse(old.startsAt))) throw new HttpError(400, "Etkinlik başlangıcı gelecekte olmalı.");
    [row] = await tx.update(events).set({ ...values, status }).where(and(eq(events.id, id), eq(events.ownerId, userId), eq(events.version, versionValue(body.version)))).returning({ id: events.id });
    if (!row) throw new HttpError(409, "Etkinlik başka bir oturumda değişti. Metnini koruyup güncel sürümü aç.");
  } else {
    if (Date.parse(startsAt) <= Date.now()) throw new HttpError(400, "Etkinlik başlangıcı gelecekte olmalı.");
    [row] = await tx.insert(events).values({ ...values, ownerId: userId, communityId: uuid(body.communityId), status: "active" }).returning({ id: events.id });
  }
  return readEvent(tx, userId, row.id);
}
export async function deleteEvent(tx: Transaction, userId: string, id: string) {
  const rows = await tx.delete(events).where(and(eq(events.id, id), eq(events.ownerId, userId))).returning({ id: events.id });
  if (!rows.length) throw new HttpError(404, "Etkinlik bulunamadı.");
  return { success: true };
}
export async function setEventRsvp(tx: Transaction, userId: string, id: string, going: boolean) {
  if (going) {
    const event = await readEvent(tx, userId, id);
    if (event.status !== "active" || Date.parse(event.startsAt) <= Date.now()) throw new HttpError(400, "Geçmiş veya iptal edilen etkinliğe katılım eklenemez.");
    await tx.insert(eventRsvps).values({ eventId: id, userId }).onConflictDoNothing();
  } else await tx.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.userId, userId)));
  return { rsvped: going };
}
