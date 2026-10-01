import { and, eq, isNull, sql } from "drizzle-orm";
import { threads, follows } from "./db/schema";
import type { Transaction } from "./db/client";
import type { CreatorAnalytics } from "../shared/types";
import { HttpError } from "./validation";
function day(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new HttpError(400, "Geçerli bir tarih seç.");
  return value;
}
export async function creatorAnalytics(tx: Transaction, userId: string, params: URLSearchParams): Promise<CreatorAnalytics> {
  for (const key of params.keys()) if (key !== "from" && key !== "to") throw new HttpError(400, "Analiz yalnızca kendi hesabın içindir.");
  const from = day(params.get("from")), to = day(params.get("to"));
  if (from && to && from > to) throw new HttpError(400, "Başlangıç tarihi bitişten sonra olamaz.");
  const [totals] = await tx.select({
    postCount: sql<number>`count(*)::int`,
    likesReceived: sql<number>`coalesce(sum((select count(*) from thread_likes l where l.thread_id=${threads.id})),0)::int`,
    repliesReceived: sql<number>`coalesce(sum((select count(*) from threads r where r.parent_id=threads.id)),0)::int`,
    repostsReceived: sql<number>`coalesce(sum((select count(*) from thread_reposts r where r.thread_id=${threads.id})),0)::int`,
  }).from(threads).where(and(eq(threads.authorId, userId), isNull(threads.parentId), from ? sql`${threads.createdAt}>=${`${from}T00:00:00Z`}::timestamptz` : undefined, to ? sql`${threads.createdAt}<${`${to}T00:00:00Z`}::timestamptz+interval '1 day'` : undefined));
  const [followers] = await tx.select({ followerCount: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followedId, userId));
  return { ...totals, ...followers, from, to };
}
