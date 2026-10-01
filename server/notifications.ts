import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notificationRows, profiles, threads } from "./db/schema";
import type { Transaction } from "./db/client";
import type { Notification, NotificationPage } from "../shared/types";
import { listPosts } from "./repository";
import { decodeCursor, encodeCursor } from "./cursor";
import { HttpError, uuid } from "./validation";

const visibleTarget = sql`(${notificationRows.threadId} is null or exists(select 1 from threads t where t.id=${notificationRows.threadId}))`;
export async function unreadNotifications(tx: Transaction, userId: string) {
  const [row] = await tx.select({ unreadCount: sql<number>`count(*)::int` }).from(notificationRows)
    .where(and(eq(notificationRows.recipientId, userId), isNull(notificationRows.readAt), visibleTarget));
  return row;
}
export async function listNotifications(tx: Transaction, userId: string, value: string | null, category: string): Promise<NotificationPage> {
  if (!["all", "reply", "like", "follow"].includes(category)) throw new HttpError(400, "Geçersiz bildirim türü.");
  const cursor = decodeCursor(value);
  const rows = await tx.select({
    id: notificationRows.id, kind: notificationRows.kind, threadId: notificationRows.threadId,
    createdAt: sql<string>`to_char(${notificationRows.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    readAt: notificationRows.readAt, actor: profiles,
  }).from(notificationRows).innerJoin(profiles, eq(profiles.id, notificationRows.actorId)).where(and(
    eq(notificationRows.recipientId, userId),
    category !== "all" ? eq(notificationRows.kind, category as "reply" | "like" | "follow") : undefined,
    cursor ? sql`(${notificationRows.createdAt},${notificationRows.id}) < (${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : undefined,
  )).orderBy(desc(notificationRows.createdAt), desc(notificationRows.id)).limit(21);
  const slots = rows.slice(0, 20);
  const threadIds = slots.flatMap(row => row.threadId ? [row.threadId] : []);
  // Explicit activity remains accessible even when its target was dismissed in Home.
  const posts = threadIds.length ? await listPosts(tx, userId, inArray(threads.id, threadIds)) : [];
  const byId = new Map(posts.map(post => [post.id, post]));
  const notifications: Notification[] = slots.flatMap(row => {
    const base = { id: row.id, createdAt: row.createdAt, readAt: row.readAt, actor: row.actor };
    if (row.kind === "follow") return [{ ...base, kind: "follow", post: null } as Notification];
    const post = row.threadId ? byId.get(row.threadId) : undefined;
    return post ? [{ ...base, kind: row.kind, post } as Notification] : [];
  });
  const last = slots.at(-1);
  return { notifications, nextCursor: rows.length > 20 && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null, ...await unreadNotifications(tx, userId) };
}
export async function markNotificationsRead(tx: Transaction, userId: string, value: unknown) {
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, "En fazla 20 bildirim seçebilirsin.");
  const ids = [...new Set(value.map(uuid))];
  if (ids.length) await tx.update(notificationRows).set({ readAt: sql`now()` }).where(and(
    eq(notificationRows.recipientId, userId), inArray(notificationRows.id, ids), isNull(notificationRows.readAt), visibleTarget,
  ));
  return { success: true, ...await unreadNotifications(tx, userId) };
}
