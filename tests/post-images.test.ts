import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { dispatch } from "../server/api";
import { applyUserContext, type Transaction } from "../server/db/client";
import { inspectImage, MAX_IMAGE_BYTES } from "../server/image-validation";
import { ingestImage, removeImage, beginImageCleanup, removeImageRegistration, registerValidatedImage, oldImageRegistrations, cleanupOldImages, type ImageStorage } from "../server/post-media";
import type { ThreadPage } from "../shared/types";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfoAAAAAASUVORK5CYII=", "base64"));
const engine = new PGlite();
const db = drizzle(engine);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const call = (userId: string, method: string, path: string, body = {}) => db.transaction(async tx => {
  await applyUserContext(tx, userId);
  return dispatch(tx as unknown as Transaction, userId, method, new URL(`http://localhost/api${path}`), body, "https://test.supabase.co");
});
const privileged = <T>(callback: (tx: Transaction) => Promise<T>) => db.transaction(tx => callback(tx as unknown as Transaction));
async function asUser(userId: string, query: string, params: unknown[] = []) {
  return engine.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return tx.query(query, params);
  });
}
async function validated(userId: string) {
  const objectPath = `${userId}/${crypto.randomUUID()}.png`;
  await engine.query("insert into storage.objects(bucket_id,name) values ('post-images',$1)", [objectPath]);
  await privileged(tx => registerValidatedImage(tx, userId, objectPath, inspectImage(png,"image/png"), async () => png));
  return objectPath;
}
beforeAll(async () => {
  await engine.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create policy broad_fixture_update on storage.objects for update to authenticated using (true);
  `);
  for (const migration of ["202609300001_social_web.sql","202609300003_post_media.sql","202609300004_feed_feedback.sql","202610010001_thread_bookmarks.sql","202610010002_profile_follows.sql","202610010003_notifications.sql","202610010004_post_images.sql","202610010005_thread_reposts.sql", "202610010006_private_account_lists.sql", "202610010007_saved_searches.sql", "202610010008_community_reposts.sql","202610010009_jobs.sql","202610010010_articles.sql","202610010011_text_drafts.sql","202610010012_account_preferences.sql","202610010013_community_events.sql","202610030001_discussions.sql","202610030002_job_shares.sql"]) {
    await engine.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url),"utf8"));
  }
  await engine.query("insert into auth.users values ($1),($2)",[alice,bob]);
  await engine.query("update profiles set username=case when id=$1 then 'alice' else 'bobby' end,name='Member',onboarded=true",[alice]);
},30000);
beforeEach(() => engine.exec("truncate threads,media_uploads,storage.objects cascade"));
afterAll(() => engine.close());

test("image inspection checks MIME, containers, dimensions, payload size and checksum", () => {
  expect(inspectImage(png,"image/png")).toMatchObject({ mimeType:"image/png",width:1,height:1,byteSize:png.length });
  expect(inspectImage(png,"image/png").sha256).toHaveLength(64);
  expect(() => inspectImage(png,"image/jpeg")).toThrow();
  expect(() => inspectImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),"image/png")).toThrow();
  expect(() => inspectImage(png.subarray(0,png.length-1),"image/png")).toThrow();
  expect(() => inspectImage(new Uint8Array(MAX_IMAGE_BYTES+1),"image/png")).toThrow("5 MiB");
  const oversized = Buffer.from(png); oversized.writeUInt32BE(8193,16);
  expect(() => inspectImage(Uint8Array.from(oversized),"image/png")).toThrow("8192");
  const tooManyPixels = Buffer.from(png); tooManyPixels.writeUInt32BE(8000,16); tooManyPixels.writeUInt32BE(8000,20);
  expect(() => inspectImage(Uint8Array.from(tooManyPixels),"image/png")).toThrow("40 milyon");
  const webp = Buffer.alloc(26); webp.write("RIFF"); webp.writeUInt32LE(18,4); webp.write("WEBPVP8L",8); webp.writeUInt32LE(6,16); webp[20]=47;
  expect(inspectImage(Uint8Array.from(webp),"image/webp")).toMatchObject({width:1,height:1,mimeType:"image/webp"});
  const jpeg = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
  expect(inspectImage(Uint8Array.from(jpeg),"image/jpeg")).toMatchObject({width:1,height:1,mimeType:"image/jpeg"});
  expect(() => inspectImage(Uint8Array.from(jpeg.subarray(0,jpeg.length-2)),"image/jpeg")).toThrow();
});

test("offline ingestion verifies stored bytes and cleans an unregistered failed upload", async () => {
  const objects = new Map<string,Uint8Array>(); let removals=0;
  const storage: ImageStorage = {
    async upload(path,bytes) { objects.set(path,bytes); await engine.query("insert into storage.objects(bucket_id,name) values ('post-images',$1)",[path]); },
    async download(path) { return objects.get(path)!; },
    async remove(path) { removals+=1; objects.delete(path); await engine.query("delete from storage.objects where name=$1",[path]); },
  };
  const register = (owner:string,path:string,metadata:ReturnType<typeof inspectImage>,download:()=>Promise<Uint8Array>) => privileged(tx=>registerValidatedImage(tx,owner,path,metadata,download));
  const accepted = await ingestImage(alice,png,"image/png",storage,"https://test.supabase.co",register);
  expect(accepted.objectPath.startsWith(`${alice}/`)).toBe(true);
  expect(accepted.url).toBe(`https://test.supabase.co/storage/v1/object/public/post-images/${accepted.objectPath}`);
  expect((await asUser(alice,"select * from media_uploads")).rows).toHaveLength(1);
  const changedStorage = { ...storage, async download() { return new TextEncoder().encode("replaced"); } };
  await expect(ingestImage(alice,png,"image/png",changedStorage,"https://test.supabase.co",register)).rejects.toMatchObject({status:400});
  expect(removals).toBe(1);
  expect((await engine.query("select * from media_uploads")).rows).toHaveLength(1);
});

test("metadata cannot be forged and registered objects remain immutable through direct Storage calls", async () => {
  const path = await validated(alice);
  expect((await asUser(bob,"select * from media_uploads")).rows).toEqual([]);
  await expect(asUser(alice,"insert into media_uploads select * from media_uploads")).rejects.toThrow();
  await expect(asUser(alice,"update media_uploads set width=8000")).rejects.toThrow();
  await expect(asUser(alice,"delete from media_uploads")).rejects.toThrow();
  expect((await asUser(alice,"delete from storage.objects where name=$1 returning *",[path])).rows).toEqual([]);
  // The FK also protects against a DELETE whose RLS snapshot predates registration.
  await expect(engine.query("delete from storage.objects where name=$1",[path])).rejects.toThrow();
  expect((await asUser(alice,"update storage.objects set name=name where name=$1 returning *",[path])).rows).toEqual([]);
  await expect(asUser(alice,"insert into storage.objects(bucket_id,name) values ('post-images',$1)",[path])).rejects.toThrow();
  await expect(asUser(bob,"insert into storage.objects(bucket_id,name) values ('post-images',$1)",[path])).rejects.toThrow();
});

test("media-only originals and replies publish atomically, hydrate attachments and reject foreign references", async () => {
  const path = await validated(alice);
  const created = await call(alice,"POST","/threads",{text:"",media:[{objectPath:path,altText:"Accessible description"}]}) as {id:string};
  const detail = await call(bob,"GET",`/threads/${created.id}`) as ThreadPage;
  expect(detail.post.text).toBe(""); expect(detail.post.media).toHaveLength(1);
  expect(detail.post.media[0]).toMatchObject({objectPath:path,mimeType:"image/png",width:1,height:1,byteSize:png.length,altText:"Accessible description",position:0});
  const reply = await call(alice,"POST","/threads",{parentId:created.id,media:[{objectPath:path,altText:""}]}) as {id:string};
  expect((await call(alice,"GET",`/threads/${reply.id}`) as ThreadPage).post.media).toHaveLength(1);
  await expect(call(bob,"POST","/threads",{text:"Foreign",media:[{objectPath:path}]})).rejects.toMatchObject({status:400});
  await expect(call(alice,"POST","/threads",{text:"",media:[]})).rejects.toMatchObject({status:400});
  await expect(call(alice,"POST","/threads",{text:"",media:Array(5).fill({objectPath:path})})).rejects.toMatchObject({status:400});
  const missing = `${alice}/${crypto.randomUUID()}.png`;
  await expect(call(alice,"POST","/threads",{text:"Must roll back",media:[{objectPath:missing}]})).rejects.toMatchObject({status:400});
  expect((await engine.query("select * from threads")).rows).toHaveLength(2);
  await expect(privileged(tx=>beginImageCleanup(tx,alice,path))).rejects.toMatchObject({status:409});
});

test("direct attachment writes copy trusted metadata and cannot empty a media-only post", async () => {
  const path=await validated(alice);
  const created=await call(alice,"POST","/threads",{text:"Text original"}) as {id:string};
  const attached=await asUser(alice,"insert into thread_media(thread_id,owner_id,object_path,mime_type,byte_size,width,height,position) values($1,$2,$3,'image/svg+xml',999,9000,9000,0) returning *",[created.id,alice,path]);
  expect(attached.rows[0]).toMatchObject({mime_type:"image/png",byte_size:png.length,width:1,height:1});
  const imageOnly=await call(alice,"POST","/threads",{media:[{objectPath:path}]}) as {id:string};
  await expect(asUser(alice,"delete from thread_media where thread_id=$1",[imageOnly.id])).rejects.toThrow();
  expect((await call(alice,"GET",`/threads/${imageOnly.id}`) as ThreadPage).post.media).toHaveLength(1);
  await expect(asUser(alice,"insert into threads(author_id,text) values($1,'')",[alice])).rejects.toThrow();
});

test("owner cleanup is bounded to old unreferenced uploads and deletion releases registered objects", async () => {
  const used=await validated(alice);
  const thread=await call(alice,"POST","/threads",{media:[{objectPath:used}]}) as {id:string};
  for(let index=0;index<22;index+=1) await validated(alice);
  await validated(bob);
  await engine.query("update media_uploads set created_at=now()-interval '2 days'");
  const fresh=await validated(alice);
  const candidates=await privileged(tx=>oldImageRegistrations(tx,alice));
  expect(candidates).toHaveLength(20); expect(candidates.map(item=>item.path)).not.toContain(used); expect(candidates.map(item=>item.path)).not.toContain(fresh);
  const storage: ImageStorage={async upload(){},async download(){return png;},async remove(path){await asUser(alice,"delete from storage.objects where name=$1",[path]);}};
  const result=await cleanupOldImages(alice,storage,owner=>privileged(tx=>oldImageRegistrations(tx,owner)),(owner,path,store)=>removeImage(owner,path,store,(id,key)=>privileged(tx=>beginImageCleanup(tx,id,key)),(id,key)=>privileged(tx=>removeImageRegistration(tx,id,key))));
  expect(result).toEqual({removed:20,failed:0});
  expect((await asUser(bob,"select * from media_uploads")).rows).toHaveLength(1);
  await call(alice,"DELETE",`/threads/${thread.id}`);
  await privileged(tx=>beginImageCleanup(tx,alice,used));
  expect((await asUser(alice,"delete from storage.objects where name=$1 returning *",[used])).rows).toHaveLength(1);
  await privileged(tx=>removeImageRegistration(tx,alice,used));
});

test("failed Storage cleanup keeps a retryable pending record and blocks attaching or replacing it", async () => {
  const path=await validated(alice);
  const begin=(owner:string,key:string)=>privileged(tx=>beginImageCleanup(tx,owner,key));
  const finish=(owner:string,key:string)=>privileged(tx=>removeImageRegistration(tx,owner,key));
  const failedStorage:ImageStorage={async upload(){},async download(){return png;},async remove(){throw new Error("Storage unavailable");}};
  await expect(removeImage(alice,path,failedStorage,begin,finish)).rejects.toThrow("Storage unavailable");
  expect((await engine.query("select cleanup_pending from media_uploads where object_path=$1",[path])).rows).toEqual([{cleanup_pending:true}]);
  expect((await privileged(tx=>oldImageRegistrations(tx,alice))).map(item=>item.path)).toContain(path);
  await expect(call(alice,"POST","/threads",{media:[{objectPath:path}]})).rejects.toMatchObject({status:400});
  await expect(asUser(alice,"insert into storage.objects(bucket_id,name) values('post-images',$1)",[path])).rejects.toThrow();
  const retryStorage={...failedStorage,async remove(key:string){expect((await asUser(alice,"delete from storage.objects where name=$1 returning *",[key])).rows).toHaveLength(1);}};
  expect(await removeImage(alice,path,retryStorage,begin,finish)).toEqual({success:true});
  expect((await engine.query("select * from media_uploads where object_path=$1",[path])).rows).toEqual([]);
});

test("profile deletion cascades its published media and trusted registration together", async () => {
  const path=await validated(alice);
  await call(alice,"POST","/threads",{media:[{objectPath:path}]});
  await engine.query("delete from auth.users where id=$1",[alice]);
  expect((await engine.query("select * from thread_media")).rows).toEqual([]);
  expect((await engine.query("select * from media_uploads")).rows).toEqual([]);
});
