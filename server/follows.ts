import { and, desc, eq, sql } from "drizzle-orm";
import { follows, profiles } from "./db/schema";
import type { Transaction } from "./db/client";
import type { FollowState, ProfileListPage } from "../shared/types";
import { profile } from "./repository";
import { HttpError } from "./validation";
import { decodeCursor, encodeCursor } from "./cursor";

export async function followState(tx: Transaction, userId: string, targetId: string): Promise<FollowState> {
  const [state] = await tx.select({
    following: sql<boolean>`exists(select 1 from profile_follows f where f.follower_id=${userId} and f.followed_id=${targetId})`,
    followerCount: sql<number>`(select count(*)::int from profile_follows f where f.followed_id=${targetId})`,
    followingCount: sql<number>`(select count(*)::int from profile_follows f where f.follower_id=${targetId})`,
  }).from(profiles).where(eq(profiles.id, targetId));
  if (!state) throw new HttpError(404, "Profil bulunamadı.");
  return state;
}

export async function setFollow(tx: Transaction, userId: string, targetId: string, following: boolean): Promise<FollowState> {
  if (userId === targetId) throw new HttpError(400, "Kendini takip edemezsin.");
  const target = await profile(tx, targetId);
  if (!target.onboarded) throw new HttpError(404, "Profil bulunamadı.");
  if (following) {
    try {
      await tx.insert(follows).values({ followerId: userId, followedId: targetId }).onConflictDoNothing();
    } catch (error) {
      const failure = error as { code?: string; cause?: { code?: string } };
      if ((failure.code || failure.cause?.code) === "23503") throw new HttpError(404, "Profil bulunamadı.");
      throw error;
    }
  } else {
    await tx.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followedId, targetId)));
  }
  return followState(tx, userId, targetId);
}

export async function listFollows(tx: Transaction, targetId: string, direction: "followers" | "following", value: string | null): Promise<ProfileListPage> {
  await profile(tx, targetId);
  const cursor = decodeCursor(value);
  const owner = direction === "followers" ? follows.followedId : follows.followerId;
  const person = direction === "followers" ? follows.followerId : follows.followedId;
  const rows = await tx.select({
    profile: profiles,
    id: person,
    createdAt: sql<string>`to_char(${follows.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }).from(follows).innerJoin(profiles, eq(profiles.id, person)).where(and(eq(owner, targetId), cursor
    ? sql`(${follows.createdAt}, ${person}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : undefined
  )).orderBy(desc(follows.createdAt), desc(person)).limit(21);
  const items = rows.slice(0, 20);
  const last = items.at(-1);
  return {
    profiles: items.map(row => row.profile),
    nextCursor: rows.length > 20 && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  };
}
