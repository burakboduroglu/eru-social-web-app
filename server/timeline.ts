import { and, eq, inArray, sql } from "drizzle-orm";
import { follows, profiles, reposts, threads } from "./db/schema";
import type { Transaction } from "./db/client";
import type { TimelineEntry, TimelinePage } from "../shared/types";
import { listPosts, profile } from "./repository";
import { HttpError } from "./validation";

type Activity = { threadId: string; actorId: string; createdAt: string; kind: "original" | "repost" };
type Snapshot = { userId: string; scope: string; activities: Activity[]; expires: number };
const snapshots = new Map<string, Snapshot>();
const lifetime = 15 * 60_000;
const capacity = 128;

function offsetCursor(value: string | null, token: string | undefined) {
  if (value === null) return 0;
  try {
    if (!value || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    const cursor = JSON.parse(bytes.toString("utf8")) as { offset: number; snapshot: string };
    if (!Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || cursor.offset % 20 !== 0 || cursor.snapshot !== token) {
      throw new Error();
    }
    return cursor.offset;
  } catch {
    throw new HttpError(400, "Geçersiz sayfa imleci.");
  }
}

export async function timeline(
  tx: Transaction,
  userId: string,
  targetId: string | undefined,
  token: string | null,
  cursor: string | null,
): Promise<TimelinePage> {
  const scope = targetId ? `profile:${targetId}` : "following";
  if (targetId && !(await profile(tx, targetId)).onboarded) throw new HttpError(404, "Profil bulunamadı.");
  const now = Date.now();
  for (const [key, value] of snapshots) {
    if (value.expires <= now) snapshots.delete(key);
  }
  let snapshot = token ? snapshots.get(token) : undefined;
  if (token && (!snapshot || snapshot.userId !== userId || snapshot.scope !== scope)) {
    throw new HttpError(410, "Akışın süresi doldu. Sayfayı yenileyebilirsin.");
  }
  if (cursor && !token) throw new HttpError(400, "Sayfa imleci için akış kimliği gerekli.");
  if (!snapshot) {
    const audience = targetId
      ? sql`a.id=${targetId}::uuid`
      : sql`exists(select 1 from profile_follows f where f.follower_id=${userId} and f.followed_id=a.id) and a.id<>${userId}::uuid`;
    const personal = targetId ? sql`true` : sql`t.community_id is null`;
    const result = await tx.execute(sql`
      select source.thread_id as "threadId",source.actor_id as "actorId",source.kind,
        to_char(source.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt"
      from (
        select t.id as thread_id,t.author_id as actor_id,t.created_at,'original' as kind from threads t join profiles a on a.id=t.author_id
        where t.parent_id is null and ${personal} and a.onboarded and ${audience}
        union all
        select t.id,r.user_id,r.created_at,'repost' as kind from thread_reposts r join threads t on t.id=r.thread_id join profiles a on a.id=r.user_id
        where t.parent_id is null and t.community_id is null and a.onboarded and ${audience}
      ) source order by source.created_at desc,source.actor_id desc,source.thread_id desc,source.kind desc
    `);
    const rows = (Array.isArray(result) ? result : (result as unknown as { rows: Activity[] }).rows) as Activity[];
    const seen = new Set<string>();
    const activities = rows.filter(row => {
      if (seen.has(row.threadId)) return false;
      seen.add(row.threadId);
      return true;
    });
    snapshot = { userId, scope, activities, expires: now + lifetime };
    token = crypto.randomUUID();
    if (snapshots.size >= capacity) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(token, snapshot);
  }

  const offset = offsetCursor(cursor, token!);
  if (offset > snapshot.activities.length) throw new HttpError(400, "Geçersiz sayfa imleci.");
  const slots = snapshot.activities.slice(offset, offset + 20);
  const ids = slots.map(row => row.threadId);
  const posts = ids.length
    ? await listPosts(tx, userId, and(
      inArray(threads.id, ids),
      sql`not exists(select 1 from feed_feedback f where f.thread_id=${threads.id} and f.user_id=${userId})`,
    ))
    : [];
  const byId = new Map(posts.map(post => [post.id, post]));
  const actorIds = [...new Set(slots.map(row => row.actorId))];
  const actors = actorIds.length
    ? await tx.select().from(profiles).where(and(inArray(profiles.id, actorIds), eq(profiles.onboarded, true)))
    : [];
  const actorById = new Map(actors.map(actor => [actor.id, actor]));
  const edges = targetId ? [] : await tx.select().from(follows).where(eq(follows.followerId, userId));
  const followed = new Set(edges.map(edge => edge.followedId));
  const activeReposts = ids.length
    ? await tx.select({
      threadId: reposts.threadId,
      userId: reposts.userId,
      createdAt: sql<string>`to_char(${reposts.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    }).from(reposts).where(inArray(reposts.threadId, ids))
    : [];
  const entries = slots.flatMap<TimelineEntry>(row => {
    const post = byId.get(row.threadId), actor = actorById.get(row.actorId);
    if (!post || !actor || (!targetId && !followed.has(actor.id))) return [];
    if (row.kind === "repost") {
      if (post.parentId || post.communityId || !activeReposts.some(repost =>
        repost.threadId === post.id && repost.userId === actor.id && repost.createdAt === row.createdAt
      )) return [];
      return [{ post, repost: { actor, createdAt: row.createdAt } }];
    }
    if (post.authorId !== actor.id || post.parentId || (!targetId && post.communityId)) return [];
    return [{ post, repost: null }];
  });
  return {
    entries,
    snapshot: token!,
    nextCursor: offset + 20 < snapshot.activities.length
      ? Buffer.from(JSON.stringify({ offset: offset + 20, snapshot: token })).toString("base64url")
      : null,
    ...(!targetId ? { followingCount: edges.length } : {}),
  };
}
