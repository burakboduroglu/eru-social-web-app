import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { bookmarks, threads } from "./db/schema";
import type { Transaction } from "./db/client";
import type { BookmarksPage } from "../shared/types";
import { listPosts } from "./repository";
import { HttpError } from "./validation";
import { decodeCursor, encodeCursor } from "./cursor";

export async function setBookmark(tx: Transaction, userId: string, threadId: string, bookmarked: boolean) {
  const [post] = await tx.select({ id: threads.id }).from(threads).where(eq(threads.id, threadId));
  if (!post) throw new HttpError(404, "Gönderi bulunamadı.");
  if (bookmarked) {
    try {
      await tx.insert(bookmarks).values({ userId, threadId }).onConflictDoNothing();
    } catch (error) {
      // A concurrently deleted original is unavailable, not invalid client data.
      const failure = error as { code?: string; cause?: { code?: string } };
      if ((failure.code || failure.cause?.code) === "23503") throw new HttpError(404, "Gönderi bulunamadı.");
      throw error;
    }
  } else {
    await tx.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.threadId, threadId)));
  }
  return { bookmarked };
}

export async function listBookmarks(tx: Transaction, userId: string, value: string | null): Promise<BookmarksPage> {
  const cursor = decodeCursor(value);
  const rows = await tx.select({
    threadId: bookmarks.threadId,
    // Casting dates through JS would truncate microseconds and skip tied records.
    createdAt: sql<string>`to_char(${bookmarks.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }).from(bookmarks).where(and(eq(bookmarks.userId, userId), cursor
    ? sql`(${bookmarks.createdAt}, ${bookmarks.threadId}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined)).orderBy(desc(bookmarks.createdAt), desc(bookmarks.threadId)).limit(21);
  const slots = rows.slice(0, 20);
  const ids = slots.map(row => row.threadId);
  // Unlike recommendation hydration, explicit saves survive feed dismissal.
  const posts = ids.length ? await listPosts(tx, userId, inArray(threads.id, ids)) : [];
  const byId = new Map(posts.map(post => [post.id, post]));
  const last = slots.at(-1);
  return {
    posts: ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),
    nextCursor: rows.length > 20 && last ? encodeCursor({ createdAt: last.createdAt, id: last.threadId }) : null,
  };
}
