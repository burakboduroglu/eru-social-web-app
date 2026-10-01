import {defaultPreferences,effectiveFeed,effectiveNotificationKind} from "../shared/preferences";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import type { ExplorePage, Job, ResourcePage, Article, TextDraft, Preferences, CreatorAnalytics, CommunityEvent } from "../shared/types";

const engine = new PGlite(), db = drizzle(engine);
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
  for (const migration of ["202609300001_social_web.sql", "202609300004_feed_feedback.sql", "202610010001_thread_bookmarks.sql", "202610010002_profile_follows.sql", "202610010003_notifications.sql", "202610010004_post_images.sql", "202610010005_thread_reposts.sql", "202610010006_private_account_lists.sql", "202610010007_saved_searches.sql", "202610010008_community_reposts.sql", "202610010009_jobs.sql", "202610010010_articles.sql", "202610010011_text_drafts.sql", "202610010012_account_preferences.sql", "202610010013_community_events.sql"]) {
    await engine.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await engine.query("insert into auth.users values($1),($2),($3)", [alice, bob, carol]);
}, 30000);
beforeEach(async () => {
  await engine.exec("truncate community_events,account_preferences,text_drafts,articles,jobs,account_lists,saved_searches,threads,profile_follows,communities cascade");
  await engine.query("update profiles set username=case when id=$1 then 'alice' when id=$2 then 'bobby' else 'carol' end,name='Member',onboarded=id<>$3 where id in ($1,$2,$3)", [alice, bob, carol]);
});
afterAll(() => engine.close());

test("Explore traverses tied timestamps without gaps and scopes cursor by query and tab", async () => {
  for (let index=0; index<24; index++) await call(alice,"POST","/threads",{text:"Explore needle"});
  await engine.exec("update threads set created_at='2026-10-01T00:00:00.123456Z'");
  const first=await call(bob,"GET","/explore?q=needle&tab=posts") as ExplorePage;
  expect(first.posts).toHaveLength(20); expect(first.nextCursor).toBeTruthy();
  const next=await call(bob,"GET",`/explore?q=needle&tab=posts&cursor=${first.nextCursor}`) as ExplorePage;
  expect(next.posts).toHaveLength(4); expect(new Set([...first.posts,...next.posts].map(row=>row.id)).size).toBe(24);
  await expect(call(bob,"GET",`/explore?q=other&tab=posts&cursor=${first.nextCursor}`)).rejects.toMatchObject({status:400});
  await expect(call(bob,"GET",`/explore?q=needle&tab=people&cursor=${first.nextCursor}`)).rejects.toMatchObject({status:400});
  expect((await call(bob,"GET","/explore?q=%25&tab=posts") as ExplorePage).posts).toEqual([]);
  expect((await call(bob,"GET","/search?q=needle") as {posts:unknown[]}).posts).toHaveLength(20);
});

const jobBody={title:"Engineer",company:"Company",location:"İstanbul",description:"Build tools",workMode:"remote",employmentType:"full-time",applicationUrl:"https://example.com/apply"};
test("Jobs enforce draft privacy, transitions, versions, saves and SQL bounds",async()=>{
 const draft=await call(alice,"POST","/jobs",jobBody) as Job;
 expect(draft.status).toBe("draft");expect((await call(bob,"GET","/jobs") as ResourcePage<Job>).items).toEqual([]);
 await expect(call(bob,"GET",`/jobs/${draft.id}`)).rejects.toMatchObject({status:404});
 expect((await asUser(bob,"select * from jobs")).rows).toEqual([]);
 await expect(asUser(bob,"insert into jobs(owner_id,title,company,description,work_mode,employment_type,application_url) values($1,'Title','Company','Text','remote','contract','https://example.com')",[alice])).rejects.toThrow();
 const published=await call(alice,"PATCH",`/jobs/${draft.id}`,{...jobBody,status:"published",version:1}) as Job;
 expect(published.version).toBe(2);expect((await call(bob,"GET",`/jobs/${draft.id}`) as Job).publisher.id).toBe(alice);
 await expect(call(alice,"PATCH",`/jobs/${draft.id}`,{...jobBody,status:"published",version:1})).rejects.toMatchObject({status:409});
 await expect(call(bob,"PATCH",`/jobs/${draft.id}`,{...jobBody,status:"closed",version:2})).rejects.toMatchObject({status:404});
 await call(bob,"PUT",`/jobs/${draft.id}/save`);await call(bob,"PUT",`/jobs/${draft.id}/save`);
 expect((await call(bob,"GET","/jobs?filter=saved") as ResourcePage<Job>).items).toHaveLength(1);
 expect((await asUser(alice,"select * from job_saves")).rows).toEqual([]);
 const closed=await call(alice,"PATCH",`/jobs/${draft.id}`,{...jobBody,status:"closed",version:2}) as Job;
 await expect(call(alice,"PATCH",`/jobs/${draft.id}`,{...jobBody,status:"draft",version:closed.version})).rejects.toMatchObject({status:400});
 await expect(asUser(alice,"update jobs set status='published' where id=$1",[draft.id])).rejects.toThrow();
 for(const applicationUrl of ["javascript:alert(1)","http://example.com","https://user:pass@example.com"]){await expect(call(alice,"POST","/jobs",{...jobBody,applicationUrl})).rejects.toMatchObject({status:400});}
 await expect(asUser(alice,"update jobs set title=' ' where id=$1",[draft.id])).rejects.toThrow();
 await call(alice,"DELETE",`/jobs/${draft.id}`);expect((await asUser(bob,"select * from job_saves")).rows).toEqual([]);
});

test("Articles keep text, private drafts and versioned published URLs",async()=>{
 const body={title:"Article",summary:"Summary",body:"<script>plain text</script>\n\nParagraph"};const draft=await call(alice,"POST","/articles",body) as Article;
 await expect(call(bob,"GET",`/articles/${draft.id}`)).rejects.toMatchObject({status:404});expect((await asUser(bob,"select * from articles")).rows).toEqual([]);
 const pub=await call(alice,"PATCH",`/articles/${draft.id}`,{...body,status:"published",version:1}) as Article;expect(pub.body).toBe(body.body);expect(pub.version).toBe(2);
 const edited=await call(alice,"PATCH",`/articles/${draft.id}`,{...body,body:"Edited\nText",status:"published",version:2}) as Article;expect(edited.id).toBe(draft.id);
 expect((await call(bob,"GET",`/articles/${draft.id}`) as Article).body).toBe("Edited\nText");
 await expect(call(alice,"PATCH",`/articles/${draft.id}`,{...body,status:"published",version:1})).rejects.toMatchObject({status:409});
 await expect(asUser(alice,"update articles set status='draft' where id=$1",[draft.id])).rejects.toThrow();
 await expect(asUser(alice,"update articles set body=$1 where id=$2",["x".repeat(50001),draft.id])).rejects.toThrow();
 expect((await asUser(bob,"delete from articles returning *")).rows).toEqual([]);
 await call(alice,"DELETE",`/articles/${draft.id}`);await expect(call(alice,"GET",`/articles/${draft.id}`)).rejects.toMatchObject({status:404});
});

test("Text drafts survive failed publication and unavailable context; successful publish atomically clears",async()=>{
 const personal=await call(alice,"POST","/drafts",{context:"personal",text:"Durable text"}) as TextDraft;
 await expect(call(bob,"GET",`/drafts/${personal.id}`)).rejects.toMatchObject({status:404});expect((await asUser(bob,"select * from text_drafts")).rows).toEqual([]);
 await expect(call(alice,"POST","/threads",{text:"",draftId:personal.id,draftVersion:1})).rejects.toMatchObject({status:400});expect((await call(alice,"GET",`/drafts/${personal.id}`) as TextDraft).text).toBe("Durable text");
 const updated=await call(alice,"PATCH",`/drafts/${personal.id}`,{context:"personal",text:"Updated text",version:1}) as TextDraft;expect(updated.version).toBe(2);
 await expect(call(alice,"POST","/threads",{text:"Published text",draftId:personal.id,draftVersion:1})).rejects.toMatchObject({status:409});
 await call(alice,"POST","/threads",{text:"Published text",draftId:personal.id,draftVersion:2});await expect(call(alice,"GET",`/drafts/${personal.id}`)).rejects.toMatchObject({status:404});
 const club=await call(alice,"POST","/communities",{name:"Draft club",username:"draft_club"}) as {id:string};await call(bob,"POST",`/communities/${club.id}/membership`,{});
 const community=await call(bob,"POST","/drafts",{context:"community",targetId:club.id,text:"Community text"}) as TextDraft;await call(bob,"DELETE",`/communities/${club.id}/membership`);
 expect((await call(bob,"GET",`/drafts/${community.id}`) as TextDraft).available).toBe(false);await expect(call(bob,"POST","/threads",{text:"Community text",communityId:club.id,draftId:community.id,draftVersion:1})).rejects.toMatchObject({status:400});
 const parent=await call(alice,"POST","/threads",{text:"Parent"}) as {id:string};const reply=await call(bob,"POST","/drafts",{context:"reply",targetId:parent.id,text:"Reply text"}) as TextDraft;await call(alice,"DELETE",`/threads/${parent.id}`);expect((await call(bob,"GET",`/drafts/${reply.id}`) as TextDraft).available).toBe(false);
 await expect(asUser(alice,"insert into text_drafts(owner_id,context,text) values($1,'reply','bad')",[alice])).rejects.toThrow();
});

test("Private preferences persist with functional URL precedence and SQL choice bounds",async()=>{
 expect(await call(alice,"GET","/preferences")).toEqual(defaultPreferences);
 const prefs:Preferences={reducedMotion:true,defaultFeed:"following",notificationKind:"reply"};await call(alice,"PATCH","/preferences",prefs);
 expect(await call(alice,"GET","/preferences")).toEqual(prefs);expect(await call(bob,"GET","/preferences")).toEqual(defaultPreferences);
 expect((await asUser(bob,"select * from account_preferences")).rows).toEqual([]);
 await expect(asUser(bob,"insert into account_preferences(owner_id) values($1)",[alice])).rejects.toThrow();
 await expect(asUser(alice,"update account_preferences set default_feed='invented'")).rejects.toThrow();
 await expect(call(alice,"PATCH","/preferences",{...prefs,reducedMotion:"yes"})).rejects.toMatchObject({status:400});
 expect(effectiveFeed(undefined,prefs)).toBe("following");expect(effectiveFeed("all",prefs)).toBe("all");expect(effectiveNotificationKind(undefined,prefs)).toBe("reply");expect(effectiveNotificationKind("follow",prefs)).toBe("follow");
});

test("Creator analytics count only persisted owned originals and real engagement",async()=>{
 const empty=await call(alice,"GET","/analytics") as CreatorAnalytics;expect(empty).toMatchObject({postCount:0,likesReceived:0,repliesReceived:0,repostsReceived:0,followerCount:0});
 const post=await call(alice,"POST","/threads",{text:"Owned"}) as {id:string};const unrelated=await call(bob,"POST","/threads",{text:"Foreign"}) as {id:string};await call(bob,"POST","/threads",{text:"Reply",parentId:post.id});
 await call(bob,"POST",`/threads/${post.id}/like`,{});await call(bob,"PUT",`/threads/${post.id}/repost`,{});await call(bob,"PUT",`/profiles/${alice}/follow`,{});
 expect(await call(alice,"GET","/analytics")).toMatchObject({postCount:1,likesReceived:1,repliesReceived:1,repostsReceived:1,followerCount:1});
 expect(await call(bob,"GET","/analytics")).toMatchObject({postCount:1,likesReceived:0,repliesReceived:0,repostsReceived:0,followerCount:0});
 await engine.query("update threads set created_at='2025-01-01' where id=$1",[post.id]);expect(await call(alice,"GET","/analytics?from=2026-01-01")).toMatchObject({postCount:0,likesReceived:0,repliesReceived:0,repostsReceived:0,followerCount:1});
 await call(bob,"POST",`/threads/${post.id}/like`,{});await call(bob,"DELETE",`/threads/${post.id}/repost`);expect(await call(alice,"GET","/analytics")).toMatchObject({likesReceived:0,repostsReceived:0});
 await expect(call(alice,"GET",`/analytics?ownerId=${bob}`)).rejects.toMatchObject({status:400});
 await call(alice,"DELETE",`/threads/${post.id}`);expect(await call(alice,"GET","/analytics")).toMatchObject({postCount:0,repliesReceived:0,followerCount:1});
 await expect(call(alice,"GET","/analytics?from=2026-02-30")).rejects.toMatchObject({status:400});
});

test("Events enforce current membership, private idempotent RSVP, times and terminal cancellation",async()=>{
 const club=await call(alice,"POST","/communities",{name:"Event club",username:"event_club"}) as {id:string};await call(bob,"POST",`/communities/${club.id}/membership`,{});
 const body={title:"Meetup",description:"Discussion",communityId:club.id,startsAt:new Date(Date.now()+86400000).toISOString(),meetingUrl:"https://example.com/meeting"};const event=await call(alice,"POST","/events",body) as CommunityEvent;
 await expect(call(carol,"GET",`/events/${event.id}`)).rejects.toMatchObject({status:404});expect((await asUser(carol,"select * from community_events")).rows).toEqual([]);
 await expect(asUser(carol,"insert into event_rsvps(event_id,user_id) values($1,$2)",[event.id,carol])).rejects.toThrow();
 await call(bob,"PUT",`/events/${event.id}/rsvp`,{});await call(bob,"PUT",`/events/${event.id}/rsvp`,{});expect((await call(bob,"GET",`/events/${event.id}`) as CommunityEvent).rsvped).toBe(true);
 expect((await asUser(alice,"select * from event_rsvps")).rows).toEqual([]);expect((await asUser(bob,"select * from event_rsvps")).rows).toHaveLength(1);
 await expect(call(bob,"PATCH",`/events/${event.id}`,{...body,status:"cancelled",version:1})).rejects.toMatchObject({status:404});
 await call(bob,"DELETE",`/communities/${club.id}/membership`);await expect(call(bob,"GET",`/events/${event.id}`)).rejects.toMatchObject({status:404});expect((await asUser(bob,"select * from event_rsvps")).rows).toEqual([]);await call(bob,"DELETE",`/events/${event.id}/rsvp`);
 await call(bob,"POST",`/communities/${club.id}/membership`,{});
 const cancelled=await call(alice,"PATCH",`/events/${event.id}`,{...body,status:"cancelled",version:1}) as CommunityEvent;expect(cancelled.version).toBe(2);
 await expect(call(bob,"PUT",`/events/${event.id}/rsvp`,{})).rejects.toMatchObject({status:400});await expect(asUser(bob,"insert into event_rsvps(event_id,user_id) values($1,$2)",[event.id,bob])).rejects.toThrow();
 await expect(asUser(alice,"update community_events set status='active' where id=$1",[event.id])).rejects.toThrow();
 await expect(call(alice,"PATCH",`/events/${event.id}`,{...body,status:"cancelled",version:1})).rejects.toMatchObject({status:409});
 await expect(call(alice,"POST","/events",{...body,startsAt:new Date(0).toISOString()})).rejects.toMatchObject({status:400});await expect(call(alice,"POST","/events",{...body,endsAt:new Date(0).toISOString()})).rejects.toMatchObject({status:400});
 await expect(asUser(alice,"insert into community_events(owner_id,community_id,title,starts_at) values($1,$2,'Past','2020-01-01')",[alice,club.id])).rejects.toThrow();
 await expect(asUser(alice,"update community_events set meeting_url='javascript:alert(1)' where id=$1",[event.id])).rejects.toThrow();
 await call(alice,"DELETE",`/events/${event.id}`);expect((await engine.query("select * from event_rsvps")).rows).toEqual([]);
});

test("Empty legacy search preserves both discovery families for the no-query Explore loader",async()=>{
 await call(alice,"POST","/communities",{name:"Discovery club",username:"discovery_club"});
 const result=await call(bob,"GET","/search") as {posts:unknown[];people:{id:string}[];communities:{name:string}[]};expect(result.posts).toEqual([]);expect(result.people.map(p=>p.id)).toContain(alice);expect(result.communities.map(c=>c.name)).toContain("Discovery club");
});

test("Jobs, Articles, Drafts and Events paginate precise tied rows with filter scoping",async()=>{
 const club=await call(alice,"POST","/communities",{name:"Pages club",username:"pages_club"}) as {id:string};
 const eventBody={title:"Page event",communityId:club.id,startsAt:new Date(Date.now()+86400000).toISOString()};
 for(let index=0;index<23;index++){
   const job=await call(alice,"POST","/jobs",jobBody) as Job;await call(alice,"PATCH",`/jobs/${job.id}`,{...jobBody,status:"published",version:1});
   const article=await call(alice,"POST","/articles",{title:"Page article",body:"Text"}) as Article;await call(alice,"PATCH",`/articles/${article.id}`,{title:"Page article",body:"Text",status:"published",version:1});
   await call(alice,"POST","/drafts",{context:"personal",text:"Page text"});await call(alice,"POST","/events",eventBody);
 }
 await engine.exec("alter table jobs disable trigger jobs_version;alter table articles disable trigger articles_version;alter table text_drafts disable trigger text_drafts_version;alter table community_events disable trigger events_version;update jobs set created_at='2026-10-01T00:00:00.123456Z';update articles set created_at='2026-10-01T00:00:00.123456Z';update text_drafts set created_at='2026-10-01T00:00:00.123456Z';update community_events set created_at='2026-10-01T00:00:00.123456Z';alter table jobs enable trigger jobs_version;alter table articles enable trigger articles_version;alter table text_drafts enable trigger text_drafts_version;alter table community_events enable trigger events_version");
 for(const [path,changed]of [["/jobs","/jobs?filter=mine"],["/articles","/articles?filter=mine"],["/drafts","/drafts"],["/events","/events?period=past"]]){
   const first=await call(alice,"GET",path) as ResourcePage<{id:string}>;expect(first.items).toHaveLength(20);
   const next=await call(alice,"GET",`${path}?cursor=${first.nextCursor}`) as ResourcePage<{id:string}>;expect(next.items).toHaveLength(3);expect(next.nextCursor).toBeNull();expect(new Set([...first.items,...next.items].map(i=>i.id)).size).toBe(23);
   if(changed!==path)await expect(call(alice,"GET",`${changed}&cursor=${first.nextCursor}`)).rejects.toMatchObject({status:400});
   await expect(call(bob,"GET",`${path}?cursor=${first.nextCursor}`)).rejects.toMatchObject({status:400});
 }
 const query="界".repeat(120);
 await engine.query("update jobs set title=$1,location=$1",[query]);
 const params=new URLSearchParams({q:query,location:query});
 const first=await call(alice,"GET",`/jobs?${params}`) as ResourcePage<Job>;
 expect(first.items).toHaveLength(20);
 params.set("cursor",first.nextCursor!);
 expect((await call(alice,"GET",`/jobs?${params}`) as ResourcePage<Job>).items).toHaveLength(3);
});
