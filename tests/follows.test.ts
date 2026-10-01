import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { TimelinePage, FollowState, ProfileListPage, ProfilePage } from "../shared/types";

const engine = new PGlite();
const db = drizzle(engine);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
const missing = "99999999-9999-4999-8999-999999999999";
const call = (userId: string, method: string, path: string, body = {}) => db.transaction(async tx => {
  await applyUserContext(tx, userId);
  return dispatch(tx as unknown as Transaction, userId, method, new URL(`http://localhost/api${path}`), body, "https://test.supabase.co");
});
async function asUser(userId: string, query: string, params: unknown[] = []) {
  return engine.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return tx.query(query, params);
  });
}
beforeAll(async () => {
  await engine.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public,auth,storage to anon,authenticated;
  `);
  for (const migration of ["202609300001_social_web.sql", "202609300004_feed_feedback.sql", "202610010001_thread_bookmarks.sql", "202610010002_profile_follows.sql", "202610010003_notifications.sql", "202610010004_post_images.sql", "202610010005_thread_reposts.sql", "202610010006_private_account_lists.sql", "202610010007_saved_searches.sql", "202610010008_community_reposts.sql"]) {
    await engine.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await engine.query("insert into auth.users values ($1), ($2), ($3)", [alice, bob, carol]);
}, 30000);
beforeEach(async () => {
  await engine.exec("truncate profile_follows, threads, communities cascade");
  await engine.query("update profiles set username=case when id=$1 then 'alice' else 'bobby' end, name='Member', onboarded=true where id in ($1,$2)", [alice, bob]);
  await engine.query("update profiles set onboarded=false where id=$1", [carol]);
});
afterAll(() => engine.close());

test("follow graph is readable to members but edge writes belong only to the follower", async () => {
  await call(alice, "PUT", `/profiles/${bob}/follow`);
  expect((await asUser(bob, "select * from profile_follows")).rows).toHaveLength(1);
  await expect(asUser(bob, "insert into profile_follows(follower_id,followed_id) values ($1,$2)", [alice, bob])).rejects.toThrow();
  expect((await asUser(bob, "delete from profile_follows where follower_id=$1 returning *", [alice])).rows).toEqual([]);
  await expect(asUser(alice, "update profile_follows set followed_id=$1", [carol])).rejects.toThrow();
  await expect(asUser(alice, "insert into profile_follows(follower_id,followed_id) values ($1,$1)", [alice])).rejects.toThrow();
  await expect(asUser(alice, "insert into profile_follows(follower_id,followed_id) values ($1,$2)", [alice, carol])).rejects.toThrow();
  await engine.transaction(async tx => {
    await tx.exec("set local role anon");
    await expect(tx.query("select * from profile_follows")).rejects.toThrow();
  });
});

test("idempotent follows return target counts, ignore forged identity and hydrate viewer state", async () => {
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  expect(await call(alice, "PUT", `/profiles/${bob}/follow`, { followerId: carol })).toEqual({ following: true, followerCount: 1, followingCount: 1 });
  const created = await engine.query("select created_at::text from profile_follows where follower_id=$1", [alice]);
  const repeated = await Promise.all(Array.from({ length: 5 }, () => call(alice, "PUT", `/profiles/${bob}/follow`)));
  expect(repeated.every(value => (value as FollowState).followerCount === 1)).toBe(true);
  expect((await engine.query("select created_at::text from profile_follows where follower_id=$1", [alice])).rows).toEqual(created.rows);
  const viewer = await call(alice, "GET", `/profiles/${bob}`) as ProfilePage;
  expect({ following: viewer.following, followerCount: viewer.followerCount, followingCount: viewer.followingCount }).toEqual({ following: true, followerCount: 1, followingCount: 1 });
  expect((await call(carol, "GET", `/profiles/${bob}`) as ProfilePage).following).toBe(false);
  expect(await call(alice, "DELETE", `/profiles/${bob}/follow`)).toEqual({ following: false, followerCount: 0, followingCount: 1 });
  expect(await call(alice, "DELETE", `/profiles/${bob}/follow`)).toEqual({ following: false, followerCount: 0, followingCount: 1 });
  expect((await call(alice, "GET", `/profiles/${alice}/followers`) as ProfileListPage).profiles.map(item => item.id)).toEqual([bob]);
});

test("follower and following lists paginate timestamp ties and microseconds in stable order", async () => {
  for (let index = 1; index <= 45; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    await engine.query("insert into auth.users values ($1)", [id]);
    await engine.query("update profiles set username=$2,name='Member',onboarded=true where id=$1", [id, `member_${index}`]);
    const timestamp = `2026-10-01T00:00:00.${String(index > 24 ? 100 : index).padStart(6, "0")}Z`;
    await engine.query("insert into profile_follows(follower_id,followed_id,created_at) values ($1,$2,$3),($2,$1,$3)", [alice, id, timestamp]);
  }
  for (const direction of ["following", "followers"] as const) {
    const expected = await engine.query<{ id: string }>(`select ${direction === "following" ? "followed_id" : "follower_id"} as id from profile_follows where ${direction === "following" ? "follower_id" : "followed_id"}=$1 order by created_at desc,id desc`, [alice]);
    const collected: string[] = [];
    const sizes: number[] = [];
    let cursor: string | null = null;
    do {
      const page = await call(bob, "GET", `/profiles/${alice}/${direction}${cursor ? `?cursor=${cursor}` : ""}`) as ProfileListPage;
      sizes.push(page.profiles.length);
      collected.push(...page.profiles.map(item => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(sizes).toEqual([20, 20, 5]);
    expect(collected).toEqual(expected.rows.map(item => item.id));
    expect(new Set(collected).size).toBe(45);
  }
});

test("Following includes only followed active personal originals, ordered newest with dismissal applied", async () => {
  const post = (userId: string, text: string, extra = {}) => call(userId, "POST", "/threads", { text, ...extra }) as Promise<{ id: string }>;
  const personal = await post(bob, "Personal original");
  const newer = await post(bob, "Newer original");
  await post(alice, "Own original");
  await post(bob, "Reply", { parentId: personal.id });
  const community = await call(bob, "POST", "/communities", { name: "Follow test", username: "follow_test" }) as { id: string };
  await post(bob, "Community original", { communityId: community.id });
  expect((await call(alice, "GET", "/threads?feed=following") as TimelinePage).entries).toEqual([]);
  await call(alice, "PUT", `/profiles/${bob}/follow`);
  const feed = await call(alice, "GET", "/threads?feed=following") as TimelinePage;
  expect(feed.entries.map(item => item.post.id)).toEqual([newer.id, personal.id]);
  expect(feed.nextCursor).toBeNull();
  await call(alice, "POST", `/threads/${newer.id}/dismiss`);
  expect((await call(alice, "GET", "/threads?feed=following") as TimelinePage).entries.map(item => item.post.id)).toEqual([personal.id]);
  await engine.query("update profiles set onboarded=false where id=$1", [bob]);
  expect((await call(alice, "GET", "/threads?feed=following") as TimelinePage).entries).toEqual([]);
  await engine.query("update profiles set onboarded=true where id=$1", [bob]);
  await call(alice, "DELETE", `/profiles/${bob}/follow`);
  expect((await call(alice, "GET", "/threads?feed=following") as TimelinePage).entries).toEqual([]);
});

test("invalid targets, malformed list cursors and unexpected route methods are rejected", async () => {
  for (const method of ["PUT", "DELETE"]) {
    await expect(call(alice, method, `/profiles/${alice}/follow`)).rejects.toMatchObject({ status: 400 });
    for (const target of [carol, missing]) await expect(call(alice, method, `/profiles/${target}/follow`)).rejects.toMatchObject({ status: 404 });
  }
  for (const [method, suffix] of [["GET", "follow"], ["POST", "follow"], ["GET", "follow/extra"], ["DELETE", "following"], ["GET", "following/extra"]]) {
    await expect(call(alice, method, `/profiles/${bob}/${suffix}`)).rejects.toMatchObject({ status: 404 });
  }
  await expect(call(alice, "GET", `/profiles/${bob}/followers?cursor=bad`)).rejects.toMatchObject({ status: 400 });
  await expect(call(alice, "GET", `/profiles/${missing}/followers`)).rejects.toMatchObject({ status: 404 });
  await expect(call(alice, "GET", "/threads?feed=unsupported")).rejects.toMatchObject({ status: 400 });
});

test("deleting a profile cascades both incoming and outgoing follow edges", async () => {
  await engine.query("update profiles set username='carol',name='Carol',onboarded=true where id=$1", [carol]);
  await call(alice, "PUT", `/profiles/${carol}/follow`);
  await call(carol, "PUT", `/profiles/${bob}/follow`);
  await engine.query("delete from auth.users where id=$1", [carol]);
  expect((await engine.query("select * from profile_follows")).rows).toEqual([]);
  expect((await call(alice, "GET", `/profiles/${bob}`) as ProfilePage).followerCount).toBe(0);
});
