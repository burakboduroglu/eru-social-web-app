import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { NotificationPage } from "../shared/types";

const engine = new PGlite();
const db = drizzle(engine);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const call = (userId: string, method: string, path: string, body = {}) => db.transaction(async tx => {
  await applyUserContext(tx, userId);
  return dispatch(tx as unknown as Transaction, userId, method, new URL(`http://localhost/api${path}`), body, "https://test.supabase.co");
});
const post = (userId: string, extra = {}) => call(userId, "POST", "/threads", { text: "Activity target", ...extra }) as Promise<{ id: string }>;
const activity = (userId: string, query = "") => call(userId, "GET", `/notifications${query}`) as Promise<NotificationPage>;
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
  for (const migration of ["202609300001_social_web.sql", "202609300004_feed_feedback.sql", "202610010001_thread_bookmarks.sql", "202610010002_profile_follows.sql", "202610010003_notifications.sql", "202610010004_post_images.sql", "202610010005_thread_reposts.sql", "202610010006_private_account_lists.sql", "202610010007_saved_searches.sql", "202610010008_community_reposts.sql","202610010009_jobs.sql","202610010010_articles.sql","202610010011_text_drafts.sql","202610010012_account_preferences.sql","202610010013_community_events.sql","202610030001_discussions.sql","202610030002_job_shares.sql"]) {
    await engine.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await engine.query("insert into auth.users values ($1), ($2)", [alice, bob]);
  await engine.query("update profiles set username=case when id=$1 then 'alice' else 'bobby' end,name='Member',onboarded=true", [alice]);
}, 30000);
beforeEach(() => engine.exec("drop policy if exists hidden_notification_target on threads; truncate threads,profile_follows,notifications cascade"));
afterAll(() => engine.close());

test("reply, like and follow events are generated from verified activity and ignore self activity", async () => {
  const original = await post(alice);
  await post(alice, { parentId: original.id });
  await call(alice, "POST", `/threads/${original.id}/like`);
  expect((await activity(alice)).notifications).toEqual([]);
  const reply = await post(bob, { parentId: original.id });
  await call(bob, "POST", `/threads/${original.id}/like`);
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  const page = await activity(alice);
  expect(page.unreadCount).toBe(3);
  expect(page.notifications.map(item => item.kind).sort()).toEqual(["follow", "like", "reply"]);
  expect(page.notifications.every(item => item.actor.id === bob)).toBe(true);
  expect(page.notifications.find(item => item.kind === "reply")?.post?.id).toBe(reply.id);
  expect(page.notifications.find(item => item.kind === "like")?.post?.id).toBe(original.id);
  expect(page.notifications.find(item => item.kind === "follow")?.post).toBeNull();
  expect((await activity(bob)).notifications).toEqual([]);
});

test("live sources deduplicate, undo removes events, and reapplying creates a fresh unread event", async () => {
  const original = await post(alice);
  await call(bob, "POST", `/threads/${original.id}/like`);
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  await asUser(bob, "insert into thread_likes(thread_id,user_id) values ($1,$2) on conflict do nothing", [original.id, bob]);
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  const old = await activity(alice);
  expect(old.notifications).toHaveLength(2);
  await call(alice, "PATCH", "/notifications/read", { ids: old.notifications.map(item => item.id) });
  expect((await activity(alice)).unreadCount).toBe(0);
  await call(bob, "POST", `/threads/${original.id}/like`);
  await call(bob, "DELETE", `/profiles/${alice}/follow`);
  expect((await activity(alice)).notifications).toEqual([]);
  await call(bob, "POST", `/threads/${original.id}/like`);
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  const fresh = await activity(alice);
  expect(fresh.unreadCount).toBe(2);
  expect(fresh.notifications.every(item => !old.notifications.some(previous => previous.id === item.id))).toBe(true);
});

test("notification privacy and column privileges prevent forged activity or recipient mutation", async () => {
  const original = await post(alice);
  await call(bob, "POST", `/threads/${original.id}/like`);
  const [notification] = (await activity(alice)).notifications;
  expect((await asUser(bob, "select * from notifications")).rows).toEqual([]);
  expect((await asUser(bob, "update notifications set read_at=now() returning id")).rows).toEqual([]);
  await expect(asUser(alice, "update notifications set actor_id=$1 where id=$2", [alice, notification.id])).rejects.toThrow();
  await expect(asUser(alice, "update notifications set kind='follow',thread_id=null where id=$1", [notification.id])).rejects.toThrow();
  await expect(asUser(alice, "update notifications set recipient_id=$1 where id=$2", [bob, notification.id])).rejects.toThrow();
  await expect(asUser(alice, "insert into notifications(recipient_id,actor_id,kind) values ($1,$2,'follow')", [alice,bob])).rejects.toThrow();
  await expect(asUser(alice, "select public.record_follow_notification()")).rejects.toThrow();
  await expect(asUser(alice, "delete from notifications")).rejects.toThrow();
  await engine.transaction(async tx => {
    await tx.exec("set local role anon");
    await expect(tx.query("select * from notifications")).rejects.toThrow();
  });
});

test("read markers apply only to requested owned rows and remain stable on retry", async () => {
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  await call(alice, "PUT", `/profiles/${bob}/follow`);
  const own = (await activity(alice)).notifications[0];
  const foreign = (await activity(bob)).notifications[0];
  expect(await call(alice, "PATCH", "/notifications/read", { ids: [own.id,foreign.id] })).toEqual({ success: true, unreadCount: 0 });
  expect((await activity(bob)).unreadCount).toBe(1);
  const readAt = (await activity(alice)).notifications[0].readAt;
  expect(readAt).toBeTruthy();
  await call(alice, "PATCH", "/notifications/read", { ids: [own.id] });
  expect((await activity(alice)).notifications[0].readAt).toBe(readAt);
  expect(await call(alice, "GET", "/notifications/unread")).toEqual({ unreadCount: 0 });
  await expect(call(alice, "PATCH", "/notifications/read", { ids: ["invalid"] })).rejects.toMatchObject({ status: 400 });
  await expect(call(alice, "PATCH", "/notifications/read", { ids: Array(21).fill(own.id) })).rejects.toMatchObject({ status: 400 });
  await expect(call(alice, "PATCH", "/notifications/read", { ids: "invalid" })).rejects.toMatchObject({ status: 400 });
});

test("activity survives 24 hours, categories count all unread, and microsecond cursors paginate stably", async () => {
  const original = await post(alice);
  for (let index = 1; index <= 45; index += 1) {
    const reply = await post(bob, { parentId: original.id });
    const timestamp = `2026-08-01T00:00:00.${String(index > 24 ? 100 : index).padStart(6, "0")}Z`;
    await engine.query("update notifications set created_at=$1 where thread_id=$2", [timestamp, reply.id]);
  }
  await call(bob, "POST", `/threads/${original.id}/like`);
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  const expected = await engine.query<{ id: string }>("select id from notifications where kind='reply' order by created_at desc,id desc");
  const collected: string[] = [];
  const sizes: number[] = [];
  let cursor: string | null = null;
  do {
    const page = await activity(alice, `?kind=reply${cursor ? `&cursor=${cursor}` : ""}`);
    sizes.push(page.notifications.length);
    expect(page.unreadCount).toBe(47);
    expect(page.notifications.every(item => item.kind === "reply")).toBe(true);
    collected.push(...page.notifications.map(item => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(sizes).toEqual([20,20,5]);
  expect(collected).toEqual(expected.rows.map(item => item.id));
  expect(new Set(collected).size).toBe(45);
});

test("inaccessible targets are omitted, excluded from unread, and cannot be marked read", async () => {
  const original = await post(alice);
  await call(bob, "POST", `/threads/${original.id}/like`);
  const own = (await activity(alice)).notifications[0];
  await engine.exec(`create policy hidden_notification_target on threads as restrictive for select to authenticated using (id <> '${original.id}'::uuid)`);
  expect(await activity(alice)).toEqual({ notifications: [], nextCursor: null, unreadCount: 0 });
  await call(alice, "PATCH", "/notifications/read", { ids: [own.id] });
  expect((await engine.query<{ read_at: string | null }>("select read_at from notifications where id=$1", [own.id])).rows[0].read_at).toBeNull();
});

test("source mutations and notifications roll back atomically and deleted targets cascade", async () => {
  const original = await post(alice);
  await expect(db.transaction(async tx => {
    await applyUserContext(tx, bob);
    await dispatch(tx as unknown as Transaction, bob, "POST", new URL("http://localhost/api/threads"), { text: "Rolled back reply", parentId: original.id }, "https://test.supabase.co");
    throw new Error("Rollback fixture");
  })).rejects.toThrow("Rollback fixture");
  expect((await activity(alice)).notifications).toEqual([]);
  await post(bob, { parentId: original.id });
  await call(bob, "POST", `/threads/${original.id}/like`);
  expect((await activity(alice)).notifications).toHaveLength(2);
  await call(alice, "DELETE", `/threads/${original.id}`);
  expect((await activity(alice)).notifications).toEqual([]);
});

test("category, cursor and method validation does not fall through to a legacy endpoint", async () => {
  await expect(activity(alice, "?kind=invalid")).rejects.toMatchObject({ status: 400 });
  await expect(activity(alice, "?cursor=bad")).rejects.toMatchObject({ status: 400 });
  for (const [method,path] of [["GET","/notifications/read"],["PATCH","/notifications/unread"],["DELETE","/notifications"],["GET","/notifications/unread/extra"]]) {
    await expect(call(alice,method,path)).rejects.toMatchObject({ status: 404 });
  }
});

test("actor deletion cascades all generated activity", async () => {
  const original = await post(alice);
  await post(bob, { parentId: original.id });
  await call(bob, "POST", `/threads/${original.id}/like`);
  await call(bob, "PUT", `/profiles/${alice}/follow`);
  expect((await activity(alice)).notifications).toHaveLength(3);
  await engine.query("delete from auth.users where id=$1", [bob]);
  expect((await activity(alice)).notifications).toEqual([]);
});
