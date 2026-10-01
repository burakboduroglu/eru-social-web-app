import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { BookmarksPage, ThreadPage } from "../shared/types";

const engine = new PGlite();
const db = drizzle(engine);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
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
async function createPost() {
  return await call(alice, "POST", "/threads", { text: "Saved original" }) as { id: string };
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
  await engine.query("insert into auth.users values ($1), ($2)", [alice, bob]);
  await engine.query("update profiles set username='alice', name='Alice', onboarded=true where id=$1", [alice]);
}, 30000);
beforeEach(async () => {
  await engine.exec("drop policy if exists hidden_test_original on threads; truncate threads cascade");
});
afterAll(() => engine.close());

test("direct bookmark access cannot enumerate, forge, delete or update another viewer's saves", async () => {
  const post = await createPost();
  await call(alice, "PUT", `/threads/${post.id}/bookmark`);
  expect((await asUser(bob, "select * from thread_bookmarks")).rows).toEqual([]);
  await expect(asUser(bob, "insert into thread_bookmarks(user_id,thread_id) values ($1,$2)", [alice, post.id])).rejects.toThrow();
  expect((await asUser(bob, "delete from thread_bookmarks where user_id=$1 returning *", [alice])).rows).toEqual([]);
  await expect(asUser(alice, "update thread_bookmarks set created_at=now() where user_id=$1", [alice])).rejects.toThrow();
  expect((await call(bob, "GET", "/bookmarks") as BookmarksPage).posts).toEqual([]);
  expect((await call(alice, "GET", "/bookmarks") as BookmarksPage).posts.map(item => item.id)).toEqual([post.id]);
  await engine.transaction(async tx => {
    await tx.exec("set local role anon");
    await expect(tx.query("select * from thread_bookmarks")).rejects.toThrow();
  });
});

test("repeated saves keep one row and original timestamp, and hydration is viewer-private", async () => {
  const post = await createPost();
  await call(bob, "POST", `/threads/${post.id}/like`);
  expect(await call(bob, "PUT", `/threads/${post.id}/bookmark`)).toEqual({ bookmarked: true });
  const first = await engine.query("select created_at::text from thread_bookmarks where thread_id=$1", [post.id]);
  const repeated = await Promise.all(Array.from({ length: 5 }, () => call(bob, "PUT", `/threads/${post.id}/bookmark`)));
  expect(repeated.every(value => (value as { bookmarked: boolean }).bookmarked)).toBe(true);
  const after = await engine.query("select created_at::text from thread_bookmarks where thread_id=$1", [post.id]);
  expect(after.rows).toEqual(first.rows);
  const viewer = await call(bob, "GET", `/threads/${post.id}`) as ThreadPage;
  expect(viewer.post.bookmarked).toBe(true);
  expect(viewer.post.liked).toBe(true);
  expect(viewer.post.likeCount).toBe(1);
  expect((await call(alice, "GET", `/threads/${post.id}`) as ThreadPage).post.bookmarked).toBe(false);
  expect(await call(alice, "DELETE", `/threads/${post.id}/bookmark`)).toEqual({ bookmarked: false });
  expect((await call(bob, "GET", "/bookmarks") as BookmarksPage).posts).toHaveLength(1);
  expect(await call(bob, "DELETE", `/threads/${post.id}/bookmark`)).toEqual({ bookmarked: false });
  expect(await call(bob, "DELETE", `/threads/${post.id}/bookmark`)).toEqual({ bookmarked: false });
  expect(await call(bob, "GET", "/bookmarks")).toEqual({ posts: [], nextCursor: null });
});

test("pagination respects tied IDs and submillisecond timestamps without duplicates or gaps", async () => {
  for (let index = 1; index <= 45; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    await engine.query("insert into threads(id,author_id,text) values ($1,$2,'Cursor original')", [id, alice]);
    // The top 21 records tie; all others differ only in microseconds.
    const timestamp = `2026-10-01T00:00:00.${String(index > 24 ? 100 : index).padStart(6, "0")}Z`;
    await engine.query("insert into thread_bookmarks(user_id,thread_id,created_at) values ($1,$2,$3)", [bob, id, timestamp]);
  }
  const expected = await engine.query<{ thread_id: string }>("select thread_id from thread_bookmarks order by created_at desc,thread_id desc");
  const collected: string[] = [];
  let cursor: string | null = null;
  const sizes: number[] = [];
  do {
    const page = await call(bob, "GET", `/bookmarks${cursor ? `?cursor=${cursor}` : ""}`) as BookmarksPage;
    sizes.push(page.posts.length);
    collected.push(...page.posts.map(post => post.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(sizes).toEqual([20, 20, 5]);
  expect(collected).toEqual(expected.rows.map(row => row.thread_id));
  expect(new Set(collected).size).toBe(45);
});

test("deleted saves cascade, new saves do not duplicate traversal, and dismissed saves remain readable", async () => {
  const ids: string[] = [];
  for (let index = 0; index < 23; index += 1) {
    const post = await createPost();
    ids.push(post.id);
    await call(bob, "PUT", `/threads/${post.id}/bookmark`);
  }
  const first = await call(bob, "GET", "/bookmarks") as BookmarksPage;
  expect(first.posts).toHaveLength(20);
  const dismissed = first.posts[0].id;
  await call(bob, "POST", `/threads/${dismissed}/dismiss`);
  expect((await call(bob, "GET", "/bookmarks") as BookmarksPage).posts.map(post => post.id)).toContain(dismissed);
  await call(alice, "DELETE", `/threads/${ids[0]}`);
  expect((await engine.query("select * from thread_bookmarks where thread_id=$1", [ids[0]])).rows).toEqual([]);
  const fresh = await createPost();
  await call(bob, "PUT", `/threads/${fresh.id}/bookmark`);
  const second = await call(bob, "GET", `/bookmarks?cursor=${first.nextCursor}`) as BookmarksPage;
  expect(second.posts.map(post => post.id)).toEqual([ids[2], ids[1]]);
  expect(second.posts.some(post => first.posts.some(previous => previous.id === post.id))).toBe(false);
  expect(second.posts.map(post => post.id)).not.toContain(fresh.id);
  expect(second.nextCursor).toBeNull();
});

test("inaccessible originals are omitted while pagination advances past their saved records", async () => {
  const ids: string[] = [];
  for (let index = 0; index < 21; index += 1) {
    const post = await createPost();
    ids.push(post.id);
    await call(bob, "PUT", `/threads/${post.id}/bookmark`);
  }
  const hidden = ids[20];
  await engine.exec(`create policy hidden_test_original on threads as restrictive for select to authenticated using (id <> '${hidden}'::uuid)`);
  const first = await call(bob, "GET", "/bookmarks") as BookmarksPage;
  expect(first.posts).toHaveLength(19);
  expect(first.posts.map(post => post.id)).not.toContain(hidden);
  expect(first.nextCursor).toBeTruthy();
  const second = await call(bob, "GET", `/bookmarks?cursor=${first.nextCursor}`) as BookmarksPage;
  expect(second.posts.map(post => post.id)).toEqual([ids[0]]);
  expect(second.nextCursor).toBeNull();
  await expect(call(bob, "PUT", `/threads/${hidden}/bookmark`)).rejects.toMatchObject({ status: 404 });
});

test("malformed cursors, unavailable originals and unsupported bookmark routes return truthful errors", async () => {
  const invalid = ["", "!", "YQ", Buffer.from(JSON.stringify({ createdAt: "2026-02-30T00:00:00.000000Z", threadId: missing })).toString("base64url")];
  for (const cursor of invalid) {
    await expect(call(bob, "GET", `/bookmarks?cursor=${cursor}`)).rejects.toMatchObject({ status: 400 });
  }
  await expect(call(bob, "PUT", `/threads/${missing}/bookmark`)).rejects.toMatchObject({ status: 404 });
  await expect(call(bob, "DELETE", `/threads/${missing}/bookmark`)).rejects.toMatchObject({ status: 404 });
  const post = await createPost();
  for (const [method, suffix] of [["GET", "bookmark"], ["POST", "bookmark"], ["DELETE", "bookmark/extra"], ["DELETE", "extra/bookmark"]]) {
    await expect(call(alice, method, `/threads/${post.id}/${suffix}`)).rejects.toMatchObject({ status: 404 });
  }
  expect((await call(alice, "GET", `/threads/${post.id}`) as ThreadPage).post.id).toBe(post.id);
});
