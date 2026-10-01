import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
let communityId: string;
let postId: string;
let replyId: string;
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  // Minimal Supabase-owned schemas; app schema, triggers and policies are real.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public, auth, storage to authenticated, anon;
    grant select, insert, delete on storage.objects to authenticated;
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/202609300001_social_web.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609300003_post_media.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609300004_feed_feedback.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010001_thread_bookmarks.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010002_profile_follows.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010003_notifications.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010004_post_images.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010005_thread_reposts.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010006_private_account_lists.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010007_saved_searches.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202610010008_community_reposts.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id) values ($1), ($2)", [alice, bob]);
}, 30000);
afterAll(async () => { await db.close(); });

describe("Supabase schema and RLS", () => {
  test("auth trigger creates profiles; users can only update their own profile", async () => {
    await asUser(alice);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(2);
    await db.query("update public.profiles set username='alice', name='Alice', onboarded=true where id=$1", [alice]);
    const result = await db.query("update public.profiles set name='Spoofed' where id=$1 returning id", [bob]);
    expect(result.rows).toHaveLength(0);
    await asUser(bob);
    await db.query("update public.profiles set username='bobby', name='Bobby', onboarded=true where id=$1", [bob]);
  });
  test("community creation atomically adds owner membership", async () => {
    await asUser(alice);
    const result = await db.query<{ id: string }>("insert into public.communities(name,username,created_by) values ('Test Community','test_community',$1) returning id", [alice]);
    communityId = result.rows[0].id;
    expect((await db.query("select * from public.community_members where community_id=$1", [communityId])).rows).toHaveLength(1);
    expect((await db.query("delete from public.community_members where community_id=$1 returning *", [communityId])).rows).toHaveLength(0);
  });
  test("nonmembers cannot post or edit community; identity spoofing fails", async () => {
    await asUser(bob);
    await expect(db.query("insert into public.threads(text,author_id,community_id) values ('No membership',$1,$2)", [bob,communityId])).rejects.toThrow();
    await expect(db.query("insert into public.threads(text,author_id) values ('Spoofed',$1)", [alice])).rejects.toThrow();
    expect((await db.query("update public.communities set bio='Hijacked' where id=$1 returning id", [communityId])).rows).toHaveLength(0);
    await expect(db.query("insert into public.community_members values ($1,$2)", [communityId,alice])).rejects.toThrow();
  });
  test("members can post and reply; reply cannot bypass community scope", async () => {
    await asUser(alice);
    postId = (await db.query<{ id: string }>("insert into public.threads(text,author_id,community_id) values ('Hello',$1,$2) returning id", [alice,communityId])).rows[0].id;
    await asUser(bob);
    await db.query("insert into public.community_members values ($1,$2)", [communityId,bob]);
    await expect(db.query("insert into public.threads(text,author_id,parent_id) values ('Wrong scope',$1,$2)", [bob,postId])).rejects.toThrow();
    replyId = (await db.query<{ id: string }>("insert into public.threads(text,author_id,parent_id,community_id) values ('Reply',$1,$2,$3) returning id", [bob,postId,communityId])).rows[0].id;
    expect((await db.query("delete from public.threads where id=$1 returning id", [postId])).rows).toHaveLength(0);
  });
  test("toggle is reversible and cannot remove another user like", async () => {
    await asUser(alice);
    const toggle = async () => (await db.query<{ result: { liked: boolean; count: number } }>("select public.toggle_thread_like($1) result", [postId])).rows[0].result;
    expect(await toggle()).toEqual({ liked: true, count: 1 });
    await asUser(bob);
    expect(await toggle()).toEqual({ liked: true, count: 2 });
    expect(await toggle()).toEqual({ liked: false, count: 1 });
    expect((await db.query("delete from public.thread_likes where user_id=$1 returning *", [alice])).rows).toHaveLength(0);
  });
  test("avatar writes are restricted to the authenticated user folder", async () => {
    await asUser(bob);
    await expect(db.query("insert into storage.objects(bucket_id,name) values ('avatars',$1)", [`${alice}/photo.png`])).rejects.toThrow();
    await db.query("insert into storage.objects(bucket_id,name) values ('avatars',$1)", [`${bob}/photo.png`]);
    await asUser(alice);
    expect((await db.query("delete from storage.objects returning id")).rows).toHaveLength(0);
  });
  test("owner deleting a post cascades other authors replies and likes", async () => {
    await asUser(alice);
    await db.query("delete from public.threads where id=$1", [postId]);
    expect((await db.query("select id from public.threads where id=$1", [replyId])).rows).toHaveLength(0);
    expect((await db.query("select * from public.thread_likes")).rows).toHaveLength(0);
  });
  test("anonymous users cannot read social data", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from public.profiles")).rejects.toThrow();
    await expect(db.query("select public.toggle_thread_like($1)", [postId])).rejects.toThrow();
  });
});

 test("media library writes and listing are isolated by user folder", async () => {
  await asUser(alice);
  await db.query("insert into storage.objects(bucket_id,name) values ('post-media',$1)", [`${alice}/sample.gif`]);
  await expect(db.query("insert into storage.objects(bucket_id,name) values ('post-media',$1)", [`${bob}/forged.gif`])).rejects.toThrow();
  await asUser(bob);
  expect((await db.query("select * from storage.objects where bucket_id='post-media'")).rows).toHaveLength(0);
  await db.query("delete from storage.objects where bucket_id='post-media'");
  await asUser(alice);
  expect((await db.query("select * from storage.objects where bucket_id='post-media'")).rows).toHaveLength(1);
});

test("feed feedback is private and cannot be forged for another viewer", async () => {
  await asUser(alice);
  const created = await db.query<{ id: string }>("insert into threads(author_id,text) values ($1,'Feedback target') returning id", [alice]);
  const id = created.rows[0].id;
  await db.query("insert into feed_feedback(user_id,thread_id) values ($1,$2)", [alice,id]);
  await expect(db.query("insert into feed_feedback(user_id,thread_id) values ($1,$2)", [bob,id])).rejects.toThrow();
  await asUser(bob);
  expect((await db.query("select * from feed_feedback")).rows).toHaveLength(0);
  await db.query("delete from feed_feedback");
  await asUser(alice);
  expect((await db.query("select * from feed_feedback where thread_id=$1", [id])).rows).toHaveLength(1);
});
