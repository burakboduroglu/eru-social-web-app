import { and, eq, sql } from "drizzle-orm";
import { reposts, threads } from "./db/schema";
import type { Transaction } from "./db/client";
import { HttpError } from "./validation";
import type { RepostState } from "../shared/types";

export async function setRepost(
  tx: Transaction,
  userId: string,
  threadId: string,
  reposted: boolean,
): Promise<RepostState> {
  const [post] = await tx.select().from(threads).where(eq(threads.id, threadId));
  if (!post) throw new HttpError(404, "Gönderi bulunamadı.");
  if (post.parentId || post.communityId) {
    throw new HttpError(400, "Yalnızca kişisel gönderiler yeniden paylaşılabilir.");
  }
  if (reposted) {
    try {
      await tx.insert(reposts).values({ userId, threadId }).onConflictDoNothing();
    } catch (error) {
      const failure = error as { code?: string; cause?: { code?: string } };
      if ((failure.code || failure.cause?.code) === "23503") {
        throw new HttpError(404, "Gönderi bulunamadı.");
      }
      throw error;
    }
  } else {
    await tx.delete(reposts).where(and(eq(reposts.userId, userId), eq(reposts.threadId, threadId)));
  }
  const [count] = await tx.select({ repostCount: sql<number>`count(*)::int` })
    .from(reposts)
    .where(eq(reposts.threadId, threadId));
  return { reposted, repostCount: count.repostCount };
}
