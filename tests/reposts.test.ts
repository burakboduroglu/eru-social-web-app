import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { FeedPage, RepostState, ThreadPage, TimelinePage } from "../shared/types";

const engine=new PGlite(); const db=drizzle(engine);
const alice="11111111-1111-4111-8111-111111111111";
const bob="22222222-2222-4222-8222-222222222222";
const carol="33333333-3333-4333-8333-333333333333";
const missing="99999999-9999-4999-8999-999999999999";
const call=(userId:string,method:string,path:string,body={})=>db.transaction(async tx=>{
  await applyUserContext(tx,userId);
  return dispatch(tx as unknown as Transaction,userId,method,new URL(`http://localhost/api${path}`),body,"https://test.supabase.co");
});
const post=(userId:string,extra={})=>call(userId,"POST","/threads",{text:`Timeline ${crypto.randomUUID()}`,...extra}) as Promise<{id:string}>;
const following=(userId:string,query="")=>call(userId,"GET",`/threads?feed=following${query}`) as Promise<TimelinePage>;
async function asUser(userId:string,query:string,params:unknown[]=[]) {
  return engine.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[userId]);await tx.exec("set local role authenticated");return tx.query(query,params);});
}
beforeAll(async()=>{
  await engine.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema public,auth,storage to anon,authenticated;
  `);
  for(const migration of ["202609300001_social_web.sql","202609300004_feed_feedback.sql","202610010001_thread_bookmarks.sql","202610010002_profile_follows.sql","202610010003_notifications.sql","202610010004_post_images.sql","202610010005_thread_reposts.sql", "202610010006_private_account_lists.sql", "202610010007_saved_searches.sql", "202610010008_community_reposts.sql","202610010009_jobs.sql","202610010010_articles.sql","202610010011_text_drafts.sql","202610010012_account_preferences.sql","202610010013_community_events.sql","202610030001_discussions.sql","202610030002_job_shares.sql"]) {
    await engine.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  }
  await engine.query("insert into auth.users values($1),($2),($3)",[alice,bob,carol]);
  await engine.query("update profiles set username=case when id=$1 then 'alice' when id=$2 then 'bobby' else 'carol' end,name='Member',onboarded=true",[alice,bob]);
},30000);
beforeEach(()=>engine.exec("drop policy if exists hidden_repost_target on threads; truncate threads,profile_follows,communities cascade"));
afterAll(()=>engine.close());

test("reposts are idempotent, own actor state is hydrated, and forged mutations fail",async()=>{
  const original=await post(bob);
  expect(await call(alice,"PUT",`/threads/${original.id}/repost`,{userId:carol})).toEqual({reposted:true,repostCount:1});
  const first=await engine.query("select created_at::text from thread_reposts");
  const repeated=await Promise.all(Array.from({length:5},()=>call(alice,"PUT",`/threads/${original.id}/repost`)));
  expect(repeated.every(value=>(value as RepostState).repostCount===1)).toBe(true);
  expect((await engine.query("select created_at::text from thread_reposts")).rows).toEqual(first.rows);
  await expect(asUser(carol,"insert into thread_reposts(user_id,thread_id) values($1,$2)",[alice,original.id])).rejects.toThrow();
  expect((await asUser(carol,"delete from thread_reposts where user_id=$1 returning *",[alice])).rows).toEqual([]);
  await expect(asUser(alice,"update thread_reposts set created_at=now()")).rejects.toThrow();
  await call(alice,"PUT",`/threads/${original.id}/bookmark`);
  const viewer=(await call(alice,"GET",`/threads/${original.id}`) as ThreadPage).post;
  expect(viewer).toMatchObject({reposted:true,repostCount:1,bookmarked:true,liked:false,likeCount:0});
  expect((await call(bob,"GET",`/threads/${original.id}`) as ThreadPage).post.reposted).toBe(false);
  expect(await call(alice,"DELETE",`/threads/${original.id}/repost`)).toEqual({reposted:false,repostCount:0});
  expect(await call(alice,"DELETE",`/threads/${original.id}/repost`)).toEqual({reposted:false,repostCount:0});
});

test("reply reposts are rejected and community roots require membership via API and direct RLS",async()=>{
  const original=await post(bob); const reply=await post(bob,{parentId:original.id});
  const community=await call(bob,"POST","/communities",{name:"Repost test",username:"repost_test"}) as {id:string};
  const scoped=await post(bob,{communityId:community.id});
  await expect(call(alice,"PUT",`/threads/${reply.id}/repost`)).rejects.toMatchObject({status:400});
  await expect(call(alice,"PUT",`/threads/${scoped.id}/repost`)).rejects.toMatchObject({status:403});
  for(const target of [reply.id,scoped.id]) await expect(asUser(alice,"insert into thread_reposts(user_id,thread_id) values($1,$2)",[alice,target])).rejects.toThrow();
  await call(alice,"POST",`/communities/${community.id}/membership`);
  const scopedReply=await post(alice,{parentId:scoped.id});
  await expect(call(alice,"PUT",`/threads/${scopedReply.id}/repost`)).rejects.toMatchObject({status:400});
  await expect(asUser(alice,"insert into thread_reposts(user_id,thread_id) values($1,$2)",[alice,scopedReply.id])).rejects.toThrow();
  await expect(call(alice,"PUT",`/threads/${missing}/repost`)).rejects.toMatchObject({status:404});
  for(const [method,suffix] of [["GET","repost"],["POST","repost"],["DELETE","repost/extra"]]) await expect(call(bob,method,`/threads/${original.id}/${suffix}`)).rejects.toMatchObject({status:404});
  expect((await call(bob,"GET",`/threads/${original.id}`) as ThreadPage).post.id).toBe(original.id);
});

test("Following deduplicates an original reached through several actors using precise activity order",async()=>{
  const original=await post(bob);
  await call(alice,"PUT",`/profiles/${bob}/follow`); await call(alice,"PUT",`/profiles/${carol}/follow`);
  await call(bob,"PUT",`/threads/${original.id}/repost`); await call(carol,"PUT",`/threads/${original.id}/repost`);
  await engine.query("update threads set created_at='2026-01-01T00:00:00Z' where id=$1",[original.id]);
  await engine.query("update thread_reposts set created_at=case when user_id=$1 then '2026-02-01T00:00:00.000001Z'::timestamptz else '2026-02-01T00:00:00.000002Z'::timestamptz end",[carol]);
  const feed=await following(alice);
  expect(feed.entries).toHaveLength(1); expect(feed.followingCount).toBe(2);
  expect(feed.entries[0].post.id).toBe(original.id); expect(feed.entries[0].repost?.actor.id).toBe(bob);
  expect(feed.entries[0].repost?.createdAt).toBe("2026-02-01T00:00:00.000002Z");
  const recommended=await call(alice,"GET","/threads") as FeedPage;
  expect(recommended.posts.map(item=>item.id)).toEqual([original.id]);
  const profile=await call(alice,"GET",`/profiles/${carol}/timeline`) as TimelinePage;
  expect(profile.entries[0].repost?.actor.id).toBe(carol);
});

test("undo hides the frozen chosen activity until refresh reveals an older original",async()=>{
  const original=await post(bob);
  await call(alice,"PUT",`/profiles/${bob}/follow`);await call(alice,"PUT",`/profiles/${carol}/follow`);
  await call(carol,"PUT",`/threads/${original.id}/repost`);
  const before=await following(alice); expect(before.entries[0].repost?.actor.id).toBe(carol);
  await call(carol,"DELETE",`/threads/${original.id}/repost`);
  expect((await following(alice,`&snapshot=${before.snapshot}`)).entries).toEqual([]);
  const refreshed=await following(alice);expect(refreshed.entries[0].repost).toBeNull();
  await call(carol,"PUT",`/threads/${original.id}/repost`);
  expect((await following(alice,`&snapshot=${before.snapshot}`)).entries).toEqual([]);
  const newSnapshot=await following(alice);expect(newSnapshot.entries[0].repost?.actor.id).toBe(carol);
  await call(alice,"DELETE",`/profiles/${carol}/follow`);
  expect((await following(alice,`&snapshot=${newSnapshot.snapshot}`)).entries).toEqual([]);
});

test("snapshot pagination freezes new activity and advances over deleted or dismissed originals",async()=>{
  await call(alice,"PUT",`/profiles/${bob}/follow`);
  const ids:string[]=[];for(let index=0;index<23;index+=1)ids.push((await post(bob)).id);
  const first=await following(alice);expect(first.entries).toHaveLength(20);expect(first.nextCursor).toBeTruthy();
  const fresh=await post(bob);
  await call(bob,"DELETE",`/threads/${ids[0]}`);await call(alice,"POST",`/threads/${ids[1]}/dismiss`);
  const second=await following(alice,`&snapshot=${first.snapshot}&cursor=${first.nextCursor}`);
  expect(second.entries.map(item=>item.post.id)).toEqual([ids[2]]);expect(second.nextCursor).toBeNull();
  expect(second.entries.map(item=>item.post.id)).not.toContain(fresh.id);
  expect(second.entries.some(item=>first.entries.some(previous=>previous.post.id===item.post.id))).toBe(false);
});

test("timeline tokens are isolated by viewer and scope and reject malformed or expired cursors",async()=>{
  const first=await following(alice);
  await expect(following(bob,`&snapshot=${first.snapshot}`)).rejects.toMatchObject({status:410});
  await expect(call(alice,"GET",`/profiles/${bob}/timeline?snapshot=${first.snapshot}`)).rejects.toMatchObject({status:410});
  const own=await call(alice,"GET",`/profiles/${bob}/timeline`) as TimelinePage;
  await expect(call(alice,"GET",`/profiles/${carol}/timeline?snapshot=${own.snapshot}`)).rejects.toMatchObject({status:410});
  await expect(following(alice,`&snapshot=${first.snapshot}&cursor=bad`)).rejects.toMatchObject({status:400});
  await expect(following(alice,"&snapshot=expired-or-unknown")).rejects.toMatchObject({status:410});
  await expect(call(alice,"GET",`/profiles/${missing}/timeline`)).rejects.toMatchObject({status:404});
  await engine.query("update profiles set onboarded=false where id=$1",[carol]);
  await expect(call(alice,"GET",`/profiles/${carol}/timeline`)).rejects.toMatchObject({status:404});
  await engine.query("update profiles set onboarded=true where id=$1",[carol]);
  const actualNow=Date.now;try{Date.now=()=>actualNow()+16*60_000;await expect(following(alice,`&snapshot=${first.snapshot}`)).rejects.toMatchObject({status:410});}finally{Date.now=actualNow;}
});

test("profile timelines include community originals; inaccessible originals and deleted reposts disappear",async()=>{
  const community=await call(bob,"POST","/communities",{name:"Timeline club",username:"timeline_club"}) as {id:string};
  const scoped=await post(bob,{communityId:community.id});const original=await post(alice);
  await call(bob,"PUT",`/threads/${original.id}/repost`);
  const profile=await call(alice,"GET",`/profiles/${bob}/timeline`) as TimelinePage;
  expect(profile.entries.map(item=>item.post.id)).toEqual([original.id,scoped.id]);
  await engine.exec(`create policy hidden_repost_target on threads as restrictive for select to authenticated using(id<>'${original.id}'::uuid)`);
  expect((await call(alice,"GET",`/profiles/${bob}/timeline?snapshot=${profile.snapshot}`) as TimelinePage).entries.map(item=>item.post.id)).toEqual([scoped.id]);
  await engine.exec("drop policy hidden_repost_target on threads");
  await call(alice,"DELETE",`/threads/${original.id}`);
  expect((await engine.query("select * from thread_reposts")).rows).toEqual([]);
  expect((await call(alice,"GET",`/profiles/${bob}/timeline?snapshot=${profile.snapshot}`) as TimelinePage).entries.map(item=>item.post.id)).toEqual([scoped.id]);
});

test("community reposts are idempotent, membership-bound, privately undoable and cascade with their source",async()=>{
  const community=await call(bob,"POST","/communities",{name:"Repost members",username:"repost_members"}) as {id:string};
  const scoped=await post(bob,{communityId:community.id});
  await call(alice,"POST",`/communities/${community.id}/membership`);
  await call(carol,"POST",`/communities/${community.id}/membership`);
  expect(await call(alice,"PUT",`/threads/${scoped.id}/repost`,{userId:carol})).toEqual({reposted:true,repostCount:1});
  const first=await engine.query("select created_at::text from thread_reposts where user_id=$1",[alice]);
  expect(await call(alice,"PUT",`/threads/${scoped.id}/repost`)).toEqual({reposted:true,repostCount:1});
  expect((await engine.query("select created_at::text from thread_reposts where user_id=$1",[alice])).rows).toEqual(first.rows);
  await asUser(carol,"insert into thread_reposts(user_id,thread_id) values($1,$2)",[carol,scoped.id]);
  await expect(asUser(alice,"insert into thread_reposts(user_id,thread_id) values($1,$2)",[bob,scoped.id])).rejects.toThrow();
  const hydrated=(await call(alice,"GET",`/threads/${scoped.id}`) as ThreadPage).post;
  expect(hydrated).toMatchObject({reposted:true,repostCount:2,communityId:community.id,community:{id:community.id},authorId:bob});
  expect((await call(alice,"GET","/threads?feed=communities") as FeedPage).posts[0]).toMatchObject({id:scoped.id,reposted:true,repostCount:2});
  expect((await call(alice,"GET","/threads") as FeedPage).posts[0]).toMatchObject({id:scoped.id,reposted:true,repostCount:2});
  await call(alice,"DELETE",`/communities/${community.id}/membership`);
  await expect(call(alice,"PUT",`/threads/${scoped.id}/repost`)).rejects.toMatchObject({status:403});
  await expect(asUser(alice,"insert into thread_reposts(user_id,thread_id) values($1,$2) on conflict do nothing",[alice,scoped.id])).rejects.toThrow();
  expect(await call(alice,"DELETE",`/threads/${scoped.id}/repost`)).toEqual({reposted:false,repostCount:1});
  expect(await call(alice,"DELETE",`/threads/${scoped.id}/repost`)).toEqual({reposted:false,repostCount:1});
  await call(bob,"DELETE",`/threads/${scoped.id}`);
  expect((await engine.query("select * from thread_reposts")).rows).toEqual([]);
});

test("community repost profiles require viewer and actor membership while Following and Lists remain personal",async()=>{
  const community=await call(bob,"POST","/communities",{name:"Scoped profile",username:"scoped_profile"}) as {id:string};
  const scoped=await post(bob,{communityId:community.id});
  await call(carol,"POST",`/communities/${community.id}/membership`);
  await call(carol,"PUT",`/threads/${scoped.id}/repost`);
  const read=(query="")=>call(alice,"GET",`/profiles/${carol}/timeline${query}`) as Promise<TimelinePage>;
  expect((await read()).entries).toEqual([]);
  await call(alice,"POST",`/communities/${community.id}/membership`);
  const joined=await read();
  expect(joined.entries).toHaveLength(1);
  expect(joined.entries[0]).toMatchObject({post:{id:scoped.id,communityId:community.id,community:{id:community.id},authorId:bob},repost:{actor:{id:carol}}});
  await call(alice,"PUT",`/profiles/${carol}/follow`);
  expect((await following(alice)).entries).toEqual([]);
  const list=await call(alice,"POST","/lists",{name:"Community actor"}) as {id:string};
  await call(alice,"PUT",`/lists/${list.id}/members/${carol}`);
  expect((await call(alice,"GET",`/lists/${list.id}/timeline`) as TimelinePage).entries).toEqual([]);
  await call(alice,"DELETE",`/communities/${community.id}/membership`);
  expect((await read(`?snapshot=${joined.snapshot}`)).entries).toEqual([]);
  await call(alice,"POST",`/communities/${community.id}/membership`);
  await call(carol,"DELETE",`/communities/${community.id}/membership`);
  expect((await read(`?snapshot=${joined.snapshot}`)).entries).toEqual([]);
  expect((await read()).entries).toEqual([]);
});

test("source visibility is rechecked for community reposts and hidden sources can be undone without leaking counts",async()=>{
  const community=await call(bob,"POST","/communities",{name:"Hidden source",username:"hidden_source"}) as {id:string};
  const scoped=await post(bob,{communityId:community.id});
  for(const user of [alice,carol]) {
    await call(user,"POST",`/communities/${community.id}/membership`);
    await call(user,"PUT",`/threads/${scoped.id}/repost`);
  }
  const profile=await call(alice,"GET",`/profiles/${carol}/timeline`) as TimelinePage;
  await engine.exec(`create policy hidden_repost_target on threads as restrictive for select to authenticated using(id<>'${scoped.id}'::uuid)`);
  expect((await call(alice,"GET",`/profiles/${carol}/timeline?snapshot=${profile.snapshot}`) as TimelinePage).entries).toEqual([]);
  await expect(call(alice,"PUT",`/threads/${scoped.id}/repost`)).rejects.toMatchObject({status:404});
  await expect(asUser(bob,"insert into thread_reposts(user_id,thread_id) values($1,$2)",[bob,scoped.id])).rejects.toThrow();
  expect((await asUser(bob,"select * from thread_reposts")).rows).toEqual([]);
  expect((await asUser(alice,"select user_id from thread_reposts")).rows).toEqual([{user_id:alice}]);
  expect(await call(alice,"DELETE",`/threads/${scoped.id}/repost`)).toEqual({reposted:false,repostCount:0});
  expect((await engine.query("select user_id from thread_reposts")).rows).toEqual([{user_id:carol}]);
  expect(await call(alice,"DELETE",`/threads/${scoped.id}/repost`)).toEqual({reposted:false,repostCount:0});
  expect((await call(alice,"GET",`/profiles/${carol}/timeline?snapshot=${profile.snapshot}`) as TimelinePage).entries).toEqual([]);
});

test("undo and repost again do not revive frozen community activities",async()=>{
  const community=await call(bob,"POST","/communities",{name:"Frozen source",username:"frozen_source"}) as {id:string};
  const scoped=await post(bob,{communityId:community.id});
  for(const user of [alice,carol]) await call(user,"POST",`/communities/${community.id}/membership`);
  await call(carol,"PUT",`/threads/${scoped.id}/repost`);
  const before=await call(alice,"GET",`/profiles/${carol}/timeline`) as TimelinePage;
  await call(carol,"DELETE",`/threads/${scoped.id}/repost`);
  expect((await call(alice,"GET",`/profiles/${carol}/timeline?snapshot=${before.snapshot}`) as TimelinePage).entries).toEqual([]);
  await call(carol,"PUT",`/threads/${scoped.id}/repost`);
  expect((await call(alice,"GET",`/profiles/${carol}/timeline?snapshot=${before.snapshot}`) as TimelinePage).entries).toEqual([]);
  expect((await call(alice,"GET",`/profiles/${carol}/timeline`) as TimelinePage).entries[0].repost?.actor.id).toBe(carol);
});
