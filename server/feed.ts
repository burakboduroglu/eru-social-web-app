import { sql } from "drizzle-orm";
import type { Transaction } from "./db/client";
import { postsByIds } from "./repository";
import { rankCandidates, type FeedCandidate, type ViewerContext } from "./feed-ranking";
import { HttpError } from "./validation";

// Bounded, viewer-scoped snapshots freeze ranking across pagination. They store
// IDs only; every page is hydrated under current RLS and dismissal rules.
const snapshots = new Map<string, { userId: string; ids: string[]; expires: number }>();
const lifetime = 15 * 60_000;
const capacity = 128;

export async function recommendedFeed(tx: Transaction, userId: string, offset: number, token?: string | null) {
  const now = Date.now();
  for (const [key, entry] of snapshots) if (entry.expires <= now) snapshots.delete(key);
  let snapshot = token ? snapshots.get(token) : undefined;
  if (token && (!snapshot || snapshot.userId !== userId)) throw new HttpError(410, "Akışın süresi doldu. Ana sayfadan yeni bir akış açabilirsin.");
  if (!snapshot) {
    const queryResult = await tx.execute(sql`
      with candidates as (
        select t.* from threads t
        where t.parent_id is null
          and not exists(select 1 from feed_feedback f where f.user_id=${userId} and f.thread_id=t.id)
        order by t.created_at desc, t.id desc limit 400
      ), interactions as (
        select t.author_id, t.community_id, 1 as weight, t.created_at
        from thread_likes l join threads t on t.id=l.thread_id
        where l.user_id=${userId} and t.author_id<>${userId} and t.created_at > now() - interval '90 days'
        union all
        select p.author_id, p.community_id, 2 as weight, r.created_at
        from threads r join threads p on p.id=r.parent_id
        where r.author_id=${userId} and p.author_id<>${userId} and r.created_at > now() - interval '90 days'
      ), history as (
        select * from interactions order by created_at desc limit 300
      )
      select
        coalesce((select json_agg(json_build_object(
          'id',t.id,'authorId',t.author_id,'communityId',t.community_id,'text',t.text,'createdAt',t.created_at,
          'likeCount',(select count(*)::int from thread_likes l where l.thread_id=t.id and l.user_id<>t.author_id),
          'replyCount',(select count(*)::int from threads r where r.parent_id=t.id and r.author_id<>t.author_id),
          'uniqueReplyAuthors',(select count(distinct r.author_id)::int from threads r where r.parent_id=t.id and r.author_id<>t.author_id)
        )) from candidates t),'[]'::json) as candidates,
        coalesce((select json_agg(m.community_id) from community_members m where m.user_id=${userId}),'[]'::json) as joined,
        coalesce((select json_object_agg(a.author_id,a.affinity) from (select author_id, least(20,sum(weight)) as affinity from history group by author_id) a),'{}'::json) as authors,
        coalesce((select json_object_agg(c.community_id,c.affinity) from (select community_id, least(20,sum(weight)) as affinity from history where community_id is not null group by community_id) c),'{}'::json) as communities
    `);
    const result = (Array.isArray(queryResult) ? queryResult : (queryResult as unknown as { rows: Record<string, unknown>[] }).rows)[0];
    const context: ViewerContext = {
      userId,
      joinedCommunityIds: new Set(result.joined as string[]),
      authorAffinity: new Map(Object.entries(result.authors as Record<string, number>)),
      communityAffinity: new Map(Object.entries(result.communities as Record<string, number>)),
    };
    const ids = rankCandidates(result.candidates as FeedCandidate[], context, now);
    snapshot = { userId, ids, expires: now + lifetime };
    token = crypto.randomUUID();
    if (snapshots.size >= capacity) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(token, snapshot);
  }
  const posts = await postsByIds(tx, userId, snapshot.ids.slice(offset, offset + 20));
  return { posts, hasMore: offset + 20 < snapshot.ids.length, snapshot: token };
}
