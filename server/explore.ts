import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { communities, profiles, threads } from "./db/schema";
import { postsByIds } from "./repository";
import type { Transaction } from "./db/client";
import type { ExplorePage } from "../shared/types";
import { nextScopedCursor, scopedCursor } from "./scoped-cursor";
import { HttpError } from "./validation";
export async function explorePage(tx: Transaction, userId: string, params: URLSearchParams): Promise<ExplorePage> {
  const query = (params.get("q") || "").trim().slice(0, 80);
  const tab = params.get("tab") || "posts";
  if (tab !== "posts" && tab !== "people" && tab !== "communities") throw new HttpError(400, "Geçersiz arama sekmesi.");
  const scope = JSON.stringify([userId, query, tab]);
  const cursor = scopedCursor(params.get("cursor"), scope);
  const table = tab === "posts" ? threads : tab === "people" ? profiles : communities;
  const pattern = `%${query.replace(/[\\%_]/g, char => `\\${char}`)}%`;
  const filter = tab === "posts" ? and(isNull(threads.parentId), ilike(threads.text, pattern), sql`not exists(select 1 from feed_feedback f where f.thread_id=${threads.id} and f.user_id=${userId})`)
    : tab === "people" ? and(eq(profiles.onboarded, true), query ? or(ilike(profiles.name, pattern), ilike(profiles.username, pattern)) : ne(profiles.id, userId))
    : or(ilike(communities.name, pattern), ilike(communities.username, pattern), ilike(communities.bio, pattern));
  const keys = await tx.select({ id: table.id, createdAt: sql<string>`to_char(${table.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` }).from(table).where(and(filter,
    cursor ? sql`(${table.createdAt},${table.id}) < (${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : undefined)).orderBy(desc(table.createdAt), desc(table.id)).limit(21);
  const shown = keys.slice(0, 20), last = shown.at(-1);
  const ids = shown.map(row => row.id);
  const result: ExplorePage = { query, tab, posts: [], people: [], communities: [], nextCursor: keys.length > 20 && last ? nextScopedCursor(scope, last) : null };
  if (!ids.length) return result;
  if (tab === "posts") result.posts = await postsByIds(tx, userId, ids);
  if (tab === "people") result.people = (await tx.select().from(profiles).where(inArray(profiles.id, ids))).sort((a,b) => ids.indexOf(a.id)-ids.indexOf(b.id));
  if (tab === "communities") result.communities = await tx.select({ id: communities.id, name: communities.name, username: communities.username, bio: communities.bio, image: communities.image, createdBy: communities.createdBy, createdAt: communities.createdAt,
    joined: sql<boolean>`exists(select 1 from community_members m where m.community_id=${communities.id} and m.user_id=${userId})`, memberCount: sql<number>`(select count(*)::int from community_members m where m.community_id=${communities.id})`
  }).from(communities).where(inArray(communities.id, ids)).orderBy(desc(communities.createdAt), desc(communities.id));
  return result;
}
