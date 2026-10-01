import { beforeAll, afterAll, test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { dispatch, handleApi } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { FeedPage, Me, Profile, SearchResults } from "../shared/types";
const engine = new PGlite();
const db = drizzle(engine);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
let postId: string;
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
  await engine.exec(await readFile(new URL("../supabase/migrations/202609300001_social_web.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202609300004_feed_feedback.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010001_thread_bookmarks.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010002_profile_follows.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010003_notifications.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010004_post_images.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010005_thread_reposts.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010006_private_account_lists.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010007_saved_searches.sql", import.meta.url), "utf8"));
  await engine.exec(await readFile(new URL("../supabase/migrations/202610010008_community_reposts.sql", import.meta.url), "utf8"));
  await engine.query("insert into auth.users values ($1), ($2)", [alice,bob]);
}, 30000);
afterAll(() => engine.close());
const call = (id: string, method: string, path: string, body = {}) => db.transaction(async tx => {
  await applyUserContext(tx, id);
  return dispatch(tx as unknown as Transaction, id, method, new URL(`http://localhost/api${path}`), body, "https://test.supabase.co");
});
test("API rejects unauthenticated requests before any database query", async () => {
  const response = await handleApi(new Request("http://localhost/api/me"));
  expect(response.status).toBe(401);
});
test("Drizzle profile operations only modify the verified caller", async () => {
  const updated = await call(alice, "PATCH", "/me", { id: bob, name: "Alice", username: "alice", bio: "Test", image: "" }) as Profile;
  expect(updated.id).toBe(alice);
  const me = await call(bob, "GET", "/me") as Me;
  expect(me.profile.onboarded).toBe(false);
});
test("Drizzle insert ignores a forged author and returns hydrated feed data", async () => {
  const created = await call(alice, "POST", "/threads", { text: "First post", authorId: bob }) as { id: string; authorId: string };
  postId = created.id;
  expect(created.authorId).toBe(alice);
  const feed = await call(bob, "GET", "/threads") as FeedPage;
  expect(feed.posts[0].author.name).toBe("Alice");
  expect(feed.posts[0].likeCount).toBe(0);
  expect(feed.posts[0].replyCount).toBe(0);
  expect(feed.posts[0].liked).toBe(false);
  expect(feed.hasMore).toBe(false);
});
test("API blocks another user's delete and invalid profile fields", async () => {
  await expect(call(bob, "DELETE", `/threads/${postId}`)).rejects.toThrow("sana ait değil");
  await expect(call(alice, "PATCH", "/me", { name: "Alice", username: "invalid name", bio: "" })).rejects.toThrow("Kullanıcı adında");
  await expect(call(alice, "PATCH", "/me", { name: "Alice", username: "alice", bio: "", image: `https://test.supabase.co/storage/v1/object/public/avatars/${bob}/file.png` })).rejects.toThrow("Geçersiz profil");
});
test("auth claims and role cannot leak across pooled transactions", async () => {
  await call(alice, "GET", "/me");
  const result = await db.execute(sql`select current_user as role, nullif(current_setting('request.jwt.claim.sub',true),'') as subject`);
  expect(result.rows[0].role).not.toBe("authenticated");
  expect(result.rows[0].subject).toBeNull();
  const next = await call(bob, "GET", "/me") as Me;
  expect(next.profile.id).toBe(bob);
});

test("community feed includes only joined communities and excludes personal posts", async () => {
  const community = await call(alice, "POST", "/communities", { name: "Design Club", username: "design", bio: "" }) as { id: string };
  const post = await call(alice, "POST", "/threads", { text: "Community post", communityId: community.id }) as { id: string };
  const before = await call(bob, "GET", "/threads?feed=communities") as FeedPage;
  expect(before.posts).toHaveLength(0);
  await call(bob, "POST", `/communities/${community.id}/membership`);
  const after = await call(bob, "GET", "/threads?feed=communities") as FeedPage;
  expect(after.posts.map(item => item.id)).toEqual([post.id]);
});

test("recommended feed snapshots paginate stably and reject another viewer's token", async () => {
  const marker = `snapshot-${crypto.randomUUID()}`;
  for (let index = 0; index < 22; index += 1) {
    await call(alice, "POST", "/threads", { text: `${marker}-${index}` });
  }

  const first = await call(bob, "GET", "/threads") as FeedPage;
  expect(first.posts).toHaveLength(20);
  expect(first.hasMore).toBe(true);
  expect(first.snapshot).toBeTruthy();
  await expect(call(alice, "GET", `/threads?snapshot=${first.snapshot}&page=1`))
    .rejects.toMatchObject({ status: 410 });

  const newlyCreated = await call(alice, "POST", "/threads", { text: `${marker}-after-snapshot` }) as { id: string };
  const second = await call(bob, "GET", `/threads?snapshot=${first.snapshot}&page=1`) as FeedPage;
  expect(second.snapshot).toBe(first.snapshot);
  expect(second.posts.length).toBeGreaterThan(0);
  expect(second.posts.map(post => post.id)).not.toContain(newlyCreated.id);
  expect(second.posts.map(post => post.id).filter(id => first.posts.some(post => post.id === id))).toEqual([]);
});

test("latest feed orders posts by creation time then ID descending", async () => {
  const marker = `latest-${crypto.randomUUID()}`;
  const created: { id: string; createdAt: string }[] = [];
  for (let index = 0; index < 3; index += 1) {
    created.push(await call(alice, "POST", "/threads", { text: `${marker}-${index}` }) as { id: string; createdAt: string });
  }

  const feed = await call(bob, "GET", "/threads?feed=latest") as FeedPage;
  const expected = [...created].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  expect(feed.posts.slice(0, 3).map(post => post.id)).toEqual(expected.map(post => post.id));
});

test("search finds posts, people and communities without treating wildcards as match-all", async () => {
  const marker = `search-${crypto.randomUUID()}`;
  await call(alice, "POST", "/threads", { text: `Hello ${marker}` });
  const found = await call(bob, "GET", `/search?q=${encodeURIComponent(marker)}`) as SearchResults;
  expect(found.posts.some(post => post.text.includes(marker))).toBe(true);
  const people = await call(bob, "GET", "/search?q=alice") as SearchResults;
  expect(people.people.some(person => person.username === "alice")).toBe(true);
  const groups = await call(bob, "GET", "/search?q=design") as SearchResults;
  expect(groups.communities.some(community => community.username === "design")).toBe(true);
  const wildcard = await call(bob, "GET", "/search?q=%25") as SearchResults;
  expect(wildcard.query).toBe("");
  expect(wildcard.posts).toEqual([]);
});

test("dismissal hides a post from an existing snapshot and undo restores it to a fresh feed", async () => {
  const created = await call(alice, "POST", "/threads", { text: `dismiss-${crypto.randomUUID()}` }) as { id: string };
  let feed = await call(bob, "GET", "/threads") as FeedPage;
  const snapshot = feed.snapshot!;
  let pageIndex = 0;
  while (!feed.posts.some(post => post.id === created.id) && feed.hasMore) {
    pageIndex += 1;
    feed = await call(bob, "GET", `/threads?snapshot=${snapshot}&page=${pageIndex}`) as FeedPage;
  }
  expect(feed.posts.map(post => post.id)).toContain(created.id);

  await call(bob, "POST", `/threads/${created.id}/dismiss`);
  const queryPage = (token: string, index: number) =>
    `/threads?snapshot=${token}${index === 0 ? "" : `&page=${index}`}`;
  const hydrated = await call(bob, "GET", queryPage(snapshot, pageIndex)) as FeedPage;
  expect(hydrated.posts.map(post => post.id)).not.toContain(created.id);

  const collectIds = async (firstPage: FeedPage): Promise<string[]> => {
    const ids = [...firstPage.posts.map(post => post.id)];
    let index = 0;
    let page = firstPage;
    while (page.hasMore) {
      index += 1;
      page = await call(bob, "GET", queryPage(firstPage.snapshot!, index)) as FeedPage;
      ids.push(...page.posts.map(post => post.id));
    }
    return ids;
  };

  const whileDismissed = await call(bob, "GET", "/threads") as FeedPage;
  expect(await collectIds(whileDismissed)).not.toContain(created.id);
  await call(bob, "DELETE", `/threads/${created.id}/dismiss`);
  const afterUndo = await call(bob, "GET", "/threads") as FeedPage;
  expect(afterUndo.snapshot).not.toBe(whileDismissed.snapshot);
  expect(await collectIds(afterUndo)).toContain(created.id);
});
