import { and, eq, ne, isNull, isNotNull, desc, ilike, or, sql, inArray, type SQL } from "drizzle-orm";
import { communities, profiles, threads, likes, members, jobs } from "./db/schema";
import type { Transaction } from "./db/client";
import type { Post, PostMedia, CommunitySummary } from "../shared/types";
import { HttpError } from "./validation";
import { jobReferenceSelection } from "./job-shares";

function postQuery(tx: Transaction, userId: string) {
  return tx.select({
    id: threads.id, text: threads.text, authorId: threads.authorId, communityId: threads.communityId,
    parentId: threads.parentId, createdAt: threads.createdAt, author: profiles, community: communities,
    jobReference: jobReferenceSelection(threads.resourceKind),
    likeCount: sql<number>`(select count(*)::int from thread_likes l where l.thread_id = ${threads.id})`,
    replyCount: sql<number>`(select count(*)::int from threads r where r.parent_id = ${threads.id})`,
    replyAuthors: sql<{ id: string; image: string }[]>`coalesce((select json_agg(preview) from (select p.id, p.image from threads r join profiles p on p.id = r.author_id where r.parent_id = ${threads.id} order by r.created_at desc limit 2) preview), '[]'::json)`,
    liked: sql<boolean>`exists(select 1 from thread_likes l where l.thread_id = ${threads.id} and l.user_id = ${userId})`,
    bookmarked: sql<boolean>`exists(select 1 from thread_bookmarks b where b.thread_id = ${threads.id} and b.user_id = ${userId})`,
    reposted: sql<boolean>`exists(select 1 from thread_reposts r where r.thread_id=${threads.id} and r.user_id=${userId})`,
    repostCount: sql<number>`(select count(*)::int from thread_reposts r where r.thread_id=${threads.id})`,
    media: sql<PostMedia[]>`coalesce((select json_agg(json_build_object('id', m.id, 'objectPath', m.object_path, 'url', ${`${process.env.SUPABASE_URL || ""}/storage/v1/object/public/post-images/`} || m.object_path, 'mimeType', m.mime_type, 'byteSize', m.byte_size, 'width', m.width, 'height', m.height, 'altText', m.alt_text, 'position', m.position) order by m.position) from thread_media m where m.thread_id=${threads.id}), '[]'::json)`,
  }).from(threads).innerJoin(profiles, eq(threads.authorId, profiles.id))
    .leftJoin(communities, eq(threads.communityId, communities.id))
    .leftJoin(jobs, and(eq(threads.jobId, jobs.id), sql`${jobs.status}<>'draft'`))
}
export async function listPosts(tx: Transaction, userId: string, filter?: SQL, offset = 0): Promise<Post[]> {
  return postQuery(tx, userId).where(filter).orderBy(desc(threads.createdAt), desc(threads.id)).limit(21).offset(offset);
}

export async function postsByIds(tx: Transaction, userId: string, ids: string[]): Promise<Post[]> {
  if (!ids.length) return [];
  const rows = await postQuery(tx, userId).where(and(inArray(threads.id, ids), sql`not exists(select 1 from feed_feedback f where f.thread_id = ${threads.id} and f.user_id = ${userId})`));
  const byId = new Map(rows.map(row => [row.id, row]));
  return ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}

export async function listCommunities(tx: Transaction, userId: string, id?: string): Promise<CommunitySummary[]> {
  return tx.select({
    id: communities.id, username: communities.username, name: communities.name, bio: communities.bio,
    image: communities.image, createdBy: communities.createdBy, createdAt: communities.createdAt,
    memberCount: sql<number>`(select count(*)::int from community_members m where m.community_id = ${communities.id})`,
    joined: sql<boolean>`exists(select 1 from community_members m where m.community_id = ${communities.id} and m.user_id = ${userId})`,
  }).from(communities).where(id ? eq(communities.id, id) : undefined).orderBy(desc(communities.createdAt));
}
export async function profile(tx: Transaction, id: string) {
  const [row] = await tx.select().from(profiles).where(eq(profiles.id, id));
  if (!row) throw new HttpError(404, "Profil bulunamadı.");
  return row;
}
export const page = (posts: Post[]) => ({ posts: posts.slice(0, 20), hasMore: posts.length > 20 });
export { and, eq, ne, isNull, isNotNull, desc, ilike, or, sql, communities, profiles, threads, likes, members };
