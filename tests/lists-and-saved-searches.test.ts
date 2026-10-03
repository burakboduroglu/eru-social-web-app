import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { AccountList, AccountListsPage, ProfileListPage, SavedSearch, SavedSearchesPage, TimelinePage } from "../shared/types";

const engine = new PGlite(), db = drizzle(engine);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
const missing = "99999999-9999-4999-8999-999999999999";
const call = (userId: string, method: string, path: string, body = {}) => db.transaction(async tx => {
  await applyUserContext(tx, userId);
  return dispatch(tx as unknown as Transaction, userId, method, new URL(`http://localhost/api${path}`), body, "https://test.supabase.co");
});
const createList = (owner = alice, name = "My accounts") => call(owner, "POST", "/lists", { name, description: "Private" }) as Promise<AccountList>;
const createPost = (owner: string, extra = {}) => call(owner, "POST", "/threads", { text: "Personal activity", ...extra }) as Promise<{ id: string }>;
const readTimeline = (owner: string, id: string, query = "") => call(owner, "GET", `/lists/${id}/timeline${query}`) as Promise<TimelinePage>;
async function asUser(userId: string, query: string, params: unknown[] = []) {
  return engine.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    await tx.exec("set local role authenticated");
    return tx.query(query, params);
  });
}
beforeAll(async () => {
  await engine.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema public,auth,storage to anon,authenticated;
  `);
  for (const migration of ["202609300001_social_web.sql", "202609300004_feed_feedback.sql", "202610010001_thread_bookmarks.sql", "202610010002_profile_follows.sql", "202610010003_notifications.sql", "202610010004_post_images.sql", "202610010005_thread_reposts.sql", "202610010006_private_account_lists.sql", "202610010007_saved_searches.sql", "202610010008_community_reposts.sql","202610010009_jobs.sql","202610010010_articles.sql","202610010011_text_drafts.sql","202610010012_account_preferences.sql","202610010013_community_events.sql","202610030001_discussions.sql","202610030002_job_shares.sql"]) {
    await engine.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await engine.query("insert into auth.users values($1),($2),($3)", [alice, bob, carol]);
}, 30000);
beforeEach(async () => {
  await engine.exec("drop policy if exists hidden_list_target on threads; truncate account_lists,saved_searches,threads,profile_follows,communities cascade");
  await engine.query("update profiles set username=case when id=$1 then 'alice' when id=$2 then 'bobby' else 'carol' end,name='Member',onboarded=id<>$3 where id in ($1,$2,$3)", [alice, bob, carol]);
});
afterAll(() => engine.close());

test("lists and members are owner-only through API and direct SQL", async () => {
  const list = await createList();
  expect(list).toMatchObject({ ownerId: alice, name: "My accounts", description: "Private", memberCount: 0 });
  await call(alice, "PUT", `/lists/${list.id}/members/${bob}`);
  expect((await call(bob, "GET", "/lists") as AccountListsPage).lists).toEqual([]);
  for (const [method, suffix, body] of [
    ["GET", "", {}], ["PATCH", "", { name: "Hijack" }], ["DELETE", "", {}],
    ["GET", "/members", {}], ["GET", "/timeline", {}], ["PUT", `/members/${alice}`, {}], ["DELETE", `/members/${bob}`, {}],
  ] as const) await expect(call(bob, method, `/lists/${list.id}${suffix}`, body)).rejects.toMatchObject({ status: 404 });
  expect((await asUser(bob, "select * from account_lists")).rows).toEqual([]);
  expect((await asUser(bob, "select * from account_list_members")).rows).toEqual([]);
  await expect(asUser(bob, "insert into account_lists(owner_id,name) values($1,'Forged')", [alice])).rejects.toThrow();
  await expect(asUser(bob, "insert into account_list_members(list_id,profile_id) values($1,$2)", [list.id, alice])).rejects.toThrow();
  expect((await asUser(bob, "delete from account_list_members returning *")).rows).toEqual([]);
  expect((await asUser(bob, "update account_lists set name='Hijack' returning *")).rows).toEqual([]);
  expect((await asUser(bob, "delete from account_lists returning *")).rows).toEqual([]);
  await expect(asUser(alice, "update account_lists set owner_id=$1", [bob])).rejects.toThrow();
  await expect(asUser(alice, "update account_list_members set profile_id=$1", [alice])).rejects.toThrow();
  await engine.transaction(async tx => {
    await tx.exec("set local role anon");
    await expect(tx.query("select * from account_lists")).rejects.toThrow();
  });
});

test("list editing validates bounds and member changes are idempotent without changing follows", async () => {
  for (const name of ["", "   ", "a".repeat(81)]) await expect(call(alice, "POST", "/lists", { name })).rejects.toMatchObject({ status: 400 });
  await expect(call(alice, "POST", "/lists", { name: "Valid", description: "a".repeat(351) })).rejects.toMatchObject({ status: 400 });
  const list = await createList();
  const edited = await call(alice, "PATCH", `/lists/${list.id}`, { name: " Edited ", description: "Changed" }) as AccountList;
  expect(edited).toMatchObject({ name: "Edited", description: "Changed", createdAt: list.createdAt });
  expect(edited.updatedAt >= list.updatedAt).toBe(true);
  for (const target of [carol, missing]) {
    await expect(call(alice, "PUT", `/lists/${list.id}/members/${target}`)).rejects.toMatchObject({ status: 404 });
    await expect(asUser(alice, "insert into account_list_members(list_id,profile_id) values($1,$2)", [list.id, target])).rejects.toThrow();
  }
  const results = await Promise.all(Array.from({ length: 5 }, () => call(alice, "PUT", `/lists/${list.id}/members/${bob}`, { ownerId: bob })));
  expect(results).toEqual(Array(5).fill({ member: true, memberCount: 1 }));
  const first = await engine.query("select created_at::text from account_list_members");
  await call(alice, "PUT", `/lists/${list.id}/members/${bob}`);
  expect((await engine.query("select created_at::text from account_list_members")).rows).toEqual(first.rows);
  expect((await engine.query("select * from profile_follows")).rows).toEqual([]);
  expect(await call(alice, "DELETE", `/lists/${list.id}/members/${bob}`)).toEqual({ member: false, memberCount: 0 });
  expect(await call(alice, "DELETE", `/lists/${list.id}/members/${bob}`)).toEqual({ member: false, memberCount: 0 });
  expect(await call(alice, "DELETE", `/lists/${list.id}/members/${missing}`)).toEqual({ member: false, memberCount: 0 });
});

test("private library and member pages preserve microseconds and timestamp ties", async () => {
  const memberList = await createList();
  for (let index = 1; index <= 45; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    await engine.query("insert into auth.users values($1) on conflict do nothing", [id]);
    await engine.query("update profiles set username=$2,name='Member',onboarded=true where id=$1", [id, `member_${index}`]);
    const timestamp = `2026-10-01T00:00:00.${String(index > 24 ? 100 : index).padStart(6, "0")}Z`;
    await engine.query("insert into account_lists(id,owner_id,name,created_at) values($1,$2,$3,$4)", [id, alice, `List ${index}`, timestamp]);
    await engine.query("insert into account_list_members(list_id,profile_id,created_at) values($1,$2,$3)", [memberList.id, id, timestamp]);
    await engine.query("insert into saved_searches(id,owner_id,query,tab,created_at) values($1,$2,$3,'posts',$4)", [id, alice, `Query ${index}`, timestamp]);
  }
  for (const kind of ["lists", "members", "searches"] as const) {
    const path = kind === "lists" ? "/lists" : kind === "searches" ? "/saved-searches" : `/lists/${memberList.id}/members`;
    const expected = await engine.query<{ id: string }>(kind === "members"
      ? "select profile_id as id from account_list_members order by created_at desc,profile_id desc"
      : `select id from ${kind === "lists" ? "account_lists" : "saved_searches"} order by created_at desc,id desc`);
    let cursor: string | null = null;
    const ids: string[] = [], sizes: number[] = [];
    do {
      const page = await call(alice, "GET", path + (cursor ? `?cursor=${cursor}` : "")) as AccountListsPage & ProfileListPage & SavedSearchesPage;
      const values = kind === "lists" ? page.lists : kind === "members" ? page.profiles : page.searches;
      sizes.push(values.length); ids.push(...values.map(item => item.id)); cursor = page.nextCursor;
    } while (cursor);
    expect(sizes).toEqual([20, 20, kind === "lists" ? 6 : 5]);
    expect(ids).toEqual(expected.rows.map(row => row.id));
    expect(new Set(ids).size).toBe(expected.rows.length);
  }
});

test("saved searches retain the tab, normalize duplicates in SQL, and isolate owners", async () => {
  const saved = await call(alice, "POST", "/saved-searches", { query: "  Solid \t  JS  ", tab: "posts", ownerId: bob }) as SavedSearch;
  expect(saved).toMatchObject({ ownerId: alice, query: "Solid JS", tab: "posts" });
  const duplicates = await Promise.all(Array.from({ length: 5 }, () => call(alice, "POST", "/saved-searches", { query: "solid\n js", tab: "posts" })));
  expect(duplicates).toEqual(Array(5).fill(saved));
  await expect(asUser(alice, "insert into saved_searches(owner_id,query,tab) values($1,' SOLID   JS ','posts')", [alice])).rejects.toThrow();
  const people = await call(alice, "POST", "/saved-searches", { query: "Solid JS", tab: "people" }) as SavedSearch;
  expect(people.id).not.toBe(saved.id);
  const other = await call(bob, "POST", "/saved-searches", { query: "Solid JS", tab: "posts" }) as SavedSearch;
  expect(other.id).not.toBe(saved.id);
  expect((await asUser(bob, "select id from saved_searches")).rows).toEqual([{ id: other.id }]);
  await expect(asUser(bob, "insert into saved_searches(owner_id,query,tab) values($1,'Private','posts')", [alice])).rejects.toThrow();
  await expect(asUser(alice, "update saved_searches set query='Changed'")).rejects.toThrow();
  await expect(call(bob, "DELETE", `/saved-searches/${saved.id}`)).rejects.toMatchObject({ status: 404 });
  expect((await asUser(bob, "delete from saved_searches where id=$1 returning *", [saved.id])).rows).toEqual([]);
  expect(await call(alice, "DELETE", `/saved-searches/${saved.id}`)).toEqual({ success: true });
  await expect(call(alice, "DELETE", `/saved-searches/${saved.id}`)).rejects.toMatchObject({ status: 404 });
});

test("saved-query and list bounds are enforced for API and direct SQL", async () => {
  for (const query of ["", "x", " ", "x".repeat(81)]) {
    await expect(call(alice, "POST", "/saved-searches", { query, tab: "posts" })).rejects.toMatchObject({ status: 400 });
    await expect(asUser(alice, "insert into saved_searches(owner_id,query,tab) values($1,$2,'posts')", [alice, query])).rejects.toThrow();
  }
  await expect(call(alice, "POST", "/saved-searches", { query: "Valid", tab: "invalid" })).rejects.toMatchObject({ status: 400 });
  await expect(asUser(alice, "insert into saved_searches(owner_id,query,tab) values($1,'Valid','invalid')", [alice])).rejects.toThrow();
  await expect(asUser(alice, "insert into account_lists(owner_id,name) values($1,' ')", [alice])).rejects.toThrow();
  await expect(asUser(alice, "insert into account_lists(owner_id,name,description) values($1,'Valid',$2)", [alice, "x".repeat(351)])).rejects.toThrow();
  await asUser(alice, "insert into saved_searches(owner_id,query,tab) values($1,'  From\n SQL  ','communities')", [alice]);
  expect((await call(alice, "GET", "/saved-searches") as SavedSearchesPage).searches[0].query).toBe("From SQL");
});

test("list timeline includes only member personal originals and eligible reposts", async () => {
  const list = await createList();
  const original = await createPost(bob), outside = await createPost(alice);
  await createPost(bob, { parentId: original.id });
  const community = await call(bob, "POST", "/communities", { name: "List club", username: "list_club" }) as { id: string };
  await createPost(bob, { communityId: community.id });
  await call(bob, "PUT", `/threads/${outside.id}/repost`);
  expect((await readTimeline(alice, list.id)).entries).toEqual([]);
  await call(alice, "PUT", `/lists/${list.id}/members/${bob}`);
  const feed = await readTimeline(alice, list.id);
  expect(feed.entries.map(entry => entry.post.id)).toEqual([outside.id, original.id]);
  expect(feed.entries[0].repost?.actor.id).toBe(bob);
  expect(feed.followingCount).toBeUndefined();
  expect((await call(alice, "GET", "/threads?feed=following") as TimelinePage).entries).toEqual([]);
  await call(bob, "DELETE", `/threads/${outside.id}/repost`);
  expect((await readTimeline(alice, list.id, `?snapshot=${feed.snapshot}`)).entries.map(entry => entry.post.id)).toEqual([original.id]);
  await call(bob, "PUT", `/threads/${outside.id}/repost`);
  expect((await readTimeline(alice, list.id, `?snapshot=${feed.snapshot}`)).entries.map(entry => entry.post.id)).toEqual([original.id]);
  await call(alice, "DELETE", `/lists/${list.id}/members/${bob}`);
  expect((await readTimeline(alice, list.id, `?snapshot=${feed.snapshot}`)).entries).toEqual([]);
});

test("list snapshot traversal freezes activity and rechecks visibility, membership and ownership", async () => {
  const list = await createList();
  await call(alice, "PUT", `/lists/${list.id}/members/${bob}`);
  const ids: string[] = [];
  for (let index = 0; index < 23; index += 1) ids.push((await createPost(bob)).id);
  const first = await readTimeline(alice, list.id);
  expect(first.entries).toHaveLength(20); expect(first.nextCursor).toBeTruthy();
  const fresh = await createPost(bob);
  await call(bob, "DELETE", `/threads/${ids[0]}`);
  await call(alice, "POST", `/threads/${ids[1]}/dismiss`);
  const second = await readTimeline(alice, list.id, `?snapshot=${first.snapshot}&cursor=${first.nextCursor}`);
  expect(second.entries.map(entry => entry.post.id)).toEqual([ids[2]]);
  expect(second.nextCursor).toBeNull();
  expect(second.entries.some(entry => entry.post.id === fresh.id)).toBe(false);
  await engine.exec(`create policy hidden_list_target on threads as restrictive for select to authenticated using(id<>'${ids[2]}'::uuid)`);
  expect((await readTimeline(alice, list.id, `?snapshot=${first.snapshot}&cursor=${first.nextCursor}`)).entries).toEqual([]);
  await engine.exec("drop policy hidden_list_target on threads");
  await call(alice, "DELETE", `/lists/${list.id}/members/${bob}`);
  expect((await readTimeline(alice, list.id, `?snapshot=${first.snapshot}`)).entries).toEqual([]);
  await expect(readTimeline(bob, list.id, `?snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 404 });
  await call(alice, "DELETE", `/lists/${list.id}`);
  await expect(readTimeline(alice, list.id, `?snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 404 });
});

test("list snapshots reject other lists, viewers, scopes, malformed cursors and expiry", async () => {
  const list = await createList(), other = await createList();
  const first = await readTimeline(alice, list.id);
  await expect(readTimeline(alice, other.id, `?snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 410 });
  const bobList = await createList(bob);
  await expect(readTimeline(bob, bobList.id, `?snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 410 });
  await expect(call(alice, "GET", `/profiles/${bob}/timeline?snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 410 });
  await expect(call(alice, "GET", `/threads?feed=following&snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 410 });
  await expect(readTimeline(alice, list.id, "?snapshot=missing")).rejects.toMatchObject({ status: 410 });
  await expect(readTimeline(alice, list.id, `?snapshot=${first.snapshot}&cursor=bad`)).rejects.toMatchObject({ status: 400 });
  await expect(readTimeline(alice, list.id, "?cursor=bad")).rejects.toMatchObject({ status: 400 });
  const actualNow = Date.now;
  try {
    Date.now = () => actualNow() + 16 * 60_000;
    await expect(readTimeline(alice, list.id, `?snapshot=${first.snapshot}`)).rejects.toMatchObject({ status: 410 });
  } finally { Date.now = actualNow; }
});

test("membership additions appear on refresh and inactive actors disappear from frozen snapshots", async () => {
  const list = await createList();
  const original = await createPost(bob);
  const empty = await readTimeline(alice, list.id);
  await call(alice, "PUT", `/lists/${list.id}/members/${bob}`);
  expect((await readTimeline(alice, list.id, `?snapshot=${empty.snapshot}`)).entries).toEqual([]);
  const refreshed = await readTimeline(alice, list.id);
  expect(refreshed.entries.map(entry => entry.post.id)).toEqual([original.id]);
  await engine.query("update profiles set onboarded=false where id=$1", [bob]);
  expect((await readTimeline(alice, list.id, `?snapshot=${refreshed.snapshot}`)).entries).toEqual([]);
});

test("private endpoints reject unexpected methods, extra segments and malformed cursors", async () => {
  const list = await createList();
  const invalid: [string, string][] = [
    ["GET", "/lists/"], ["GET", "/lists//"], ["PUT", "/lists"], ["POST", `/lists/${list.id}`],
    ["GET", `/lists/${list.id}/extra`], ["GET", `/lists/${list.id}/members/`], ["GET", `/lists/${list.id}/timeline/extra`],
    ["POST", `/lists/${list.id}/members/${bob}`], ["PUT", `/lists/${list.id}//members/${bob}`],
    ["DELETE", `/lists/${list.id}/members/${bob}/extra`], ["GET", "/saved-searches/"], ["PATCH", "/saved-searches"],
    ["GET", `/saved-searches/${list.id}`], ["DELETE", `/saved-searches/${list.id}/extra`],
  ];
  for (const [method, path] of invalid) await expect(call(alice, method, path)).rejects.toMatchObject({ status: 404 });
  for (const path of ["/lists", "/saved-searches", `/lists/${list.id}/members`]) {
    await expect(call(alice, "GET", `${path}?cursor=bad`)).rejects.toMatchObject({ status: 400 });
  }
  await expect(call(alice, "GET", "/lists/invalid-id")).rejects.toMatchObject({ status: 400 });
});

test("account deletion cascades owned libraries and incoming list membership", async () => {
  const id = "44444444-4444-4444-8444-444444444444";
  await engine.query("insert into auth.users values($1)", [id]);
  await engine.query("update profiles set username='fourth',name='Fourth',onboarded=true where id=$1", [id]);
  const owned = await createList(id), incoming = await createList();
  await call(alice, "PUT", `/lists/${incoming.id}/members/${id}`);
  await call(id, "PUT", `/lists/${owned.id}/members/${bob}`);
  await call(id, "POST", "/saved-searches", { query: "Account deleted", tab: "posts" });
  await engine.query("delete from auth.users where id=$1", [id]);
  expect((await engine.query("select * from account_list_members")).rows).toEqual([]);
  expect((await engine.query("select * from saved_searches")).rows).toEqual([]);
  await expect(call(alice, "GET", `/lists/${owned.id}`)).rejects.toMatchObject({ status: 404 });
  expect((await call(alice, "GET", `/lists/${incoming.id}`) as AccountList).memberCount).toBe(0);
});
