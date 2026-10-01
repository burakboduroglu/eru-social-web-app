import { listEvents, readEvent, saveEvent, deleteEvent, setEventRsvp } from "./events";
import { creatorAnalytics } from "./analytics";
import { readPreferences, savePreferences } from "./preferences";
import { listTextDrafts, readTextDraft, saveTextDraft, deleteTextDraft, publishingDraft } from "./text-drafts";
import { textDrafts } from "./db/schema";
import { listArticles, readArticle, saveArticle, deleteArticle } from "./articles";
import { listJobs, readJob, saveJob, deleteJob, setJobSave } from "./jobs";
import { explorePage } from "./explore";
import { ServerTiming } from "./timing";
import { listBookmarks, setBookmark } from "./bookmarks";
import { followState, listFollows, setFollow } from "./follows";
import { listNotifications, markNotificationsRead, unreadNotifications } from "./notifications";
import { attachImages, cleanupOldImages, imageReferences, imageStorage, ingestImage, removeImage } from "./post-media";
import { MAX_IMAGE_BYTES } from "./image-validation";
import { setRepost } from "./reposts";
import { timeline } from "./timeline";
import { accountList, deleteAccountList, listAccountLists, listAccountMembers, saveAccountList, setAccountMember } from "./lists";
import { deleteSavedSearch, listSavedSearches, saveSearch } from "./saved-searches";
import { recommendedFeed } from "./feed";
import { feedFeedback } from "./db/schema";
import { getLinkPreview } from "./link-preview";
import { createClient } from "@supabase/supabase-js";
import { withUser, type Transaction } from "./db/client";
import { HttpError, object, text, uuid, username, pageOffset, avatar } from "./validation";
import { listPosts, listCommunities, profile, page, and, eq, ne, isNull, isNotNull, desc, ilike, or, sql, communities, profiles, threads, members } from "./repository";

export function publicConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new HttpError(503, "Supabase bağlantısı henüz ayarlanmadı.");
  return { url, publishableKey };
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
let authClient: ReturnType<typeof createClient> | undefined;
let authConfigKey = "";
function privateRoute(url: URL, method: string): string[] | undefined {
  const path = url.pathname.slice(4);
  if (!/^\/(lists|saved-searches)(\/|$)/.test(path)) return undefined;
  const parts = path.split("/").slice(1);
  const collection = parts.length === 1 && (method === "GET" || method === "POST");
  const resource = parts.length === 2 && !!parts[1] && (parts[0] === "lists"
    ? ["GET", "PATCH", "DELETE"].includes(method) : method === "DELETE");
  const content = parts[0] === "lists" && parts.length === 3 && !!parts[1] && ["members", "timeline"].includes(parts[2]) && method === "GET";
  const member = parts[0] === "lists" && parts.length === 4 && !!parts[1] && parts[2] === "members" && !!parts[3] && (method === "PUT" || method === "DELETE");
  if (!collection && !resource && !content && !member) throw new HttpError(404, "İşlem bulunamadı.");
  return parts;
}
export async function handleApi(request: Request) {
  const timing = new ServerTiming();
  const send = (value: unknown, status = 200) => {
    const response = json(value, status);
    response.headers.set("Server-Timing", timing.toHeaderValue());
    return response;
  };
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/config") return send(publicConfig());
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) throw new HttpError(401, "Giriş yapmalısın.");
    const config = publicConfig();
    const configKey = `${config.url}:${config.publishableKey}`;
    if (!authClient || authConfigKey !== configKey) {
      authClient = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      authConfigKey = configKey;
    }
    // getClaims verifies the signature and expiry with cached JWKS. Supabase
    // falls back to Auth-server verification for legacy symmetric signing keys.
    const { data, error } = await timing.measure("auth", () => authClient!.auth.getClaims(bearer.slice(7)));
    const claims = data?.claims;
    if (error || !claims || claims.role !== "authenticated" || typeof claims.sub !== "string" || claims.iss !== `${config.url}/auth/v1` || !(claims.aud === "authenticated" || (Array.isArray(claims.aud) && claims.aud.includes("authenticated")))) throw new HttpError(401, "Oturum geçersiz. Tekrar giriş yap.");
    const userId = uuid(claims.sub);
    if (url.pathname === "/api/media/images" || url.pathname === "/api/media/images/cleanup") {
      const storage = imageStorage(config, bearer);
      if (url.pathname === "/api/media/images" && request.method === "POST") {
        if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new HttpError(400, "Görsel en fazla 5 MiB olmalı.");
        return send(await ingestImage(userId, new Uint8Array(await request.arrayBuffer()), request.headers.get("content-type") || "", storage, config.url));
      }
      if (url.pathname === "/api/media/images" && request.method === "DELETE") return send(await removeImage(userId, url.searchParams.get("path"), storage));
      if (url.pathname === "/api/media/images/cleanup" && request.method === "POST") {
        try {
          const raw = await request.text();
          if (Buffer.byteLength(raw) > 16 * 1024) throw new Error();
          object(JSON.parse(raw));
        } catch { throw new HttpError(400, "Geçersiz istek gövdesi."); }
        return send(await cleanupOldImages(userId, storage));
      }
      throw new HttpError(404, "İşlem bulunamadı.");
    }
    if (request.method === "GET" && url.pathname === "/api/link-preview") return send({ preview: await timing.measure("preview", () => getLinkPreview(url.searchParams.get("url") || "")) });
    privateRoute(url, request.method);
    let body: Record<string, unknown> = {};
    if (["POST", "PATCH", "PUT"].includes(request.method)) {
      try {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > (url.pathname.startsWith("/api/articles") ? 220 * 1024 : url.pathname.startsWith("/api/jobs") ? 100 * 1024 : 16 * 1024)) throw new Error();
        body = raw ? object(JSON.parse(raw)) : request.method === "PUT" && /^\/api\/(events\/[^/]+\/rsvp|jobs\/[^/]+\/save|threads\/[^/]+\/(bookmark|repost)|profiles\/[^/]+\/follow)$/.test(url.pathname) ? {} : object(null);
      } catch { throw new HttpError(400, "Geçersiz istek gövdesi."); }
    }
    return send(await timing.measure("database", () => withUser(userId, tx => dispatch(tx, userId, request.method, url, body, config.url))));
  } catch (error) {
    if (error instanceof HttpError) return send({ error: error.message }, error.status);
    // Drivers can include SQL parameters in errors. Never return or log raw errors.
    const cause = error as { code?: string; cause?: { code?: string } };
    const code = cause.code || cause.cause?.code;
    if (code === "23505") return send({ error: "Bu kullanıcı adı zaten kullanımda." }, 409);
    if (code === "42501") return send({ error: "Bu işlem için yetkin yok." }, 403);
    if (code === "23514" || code === "23503" || code === "22P02") return send({ error: "Veriler geçersiz veya kayıt artık mevcut değil." }, 400);
    console.error("API request failed", { code: code || "unavailable" });
    return send({ error: "İşlem tamamlanamadı. Veritabanı bağlantısını ve kurulumu kontrol et." }, 503);
  }
}

export async function dispatch(tx: Transaction, userId: string, method: string, url: URL, body: Record<string, unknown>, supabaseUrl: string): Promise<unknown> {
  const resourcePath = url.pathname.slice(4);
  if (/^\/jobs(\/|$)/.test(resourcePath)) {
    const match = /^\/jobs(?:\/([^/]+)(?:\/(save))?)?$/.exec(resourcePath);
    if (!match) throw new HttpError(404,"İşlem bulunamadı.");
    const id=match[1] ? uuid(match[1]) : undefined;
    if (!id && method==="GET") return listJobs(tx,userId,url.searchParams);
    if (!id && method==="POST") return saveJob(tx,userId,body);
    if (id && !match[2] && method==="GET") return readJob(tx,userId,id);
    if (id && !match[2] && method==="PATCH") return saveJob(tx,userId,body,id);
    if (id && !match[2] && method==="DELETE") return deleteJob(tx,userId,id);
    if (id && match[2] && ["PUT","DELETE"].includes(method)) return setJobSave(tx,userId,id,method==="PUT");
    throw new HttpError(404,"İşlem bulunamadı.");
  }
  if (/^\/articles(\/|$)/.test(resourcePath)) {
    const match=/^\/articles(?:\/([^/]+))?$/.exec(resourcePath);if(!match)throw new HttpError(404,"İşlem bulunamadı.");const id=match[1]?uuid(match[1]):undefined;
    if(!id&&method==="GET")return listArticles(tx,userId,url.searchParams);
    if(!id&&method==="POST")return saveArticle(tx,userId,body);
    if(id&&method==="GET")return readArticle(tx,id);
    if(id&&method==="PATCH")return saveArticle(tx,userId,body,id);
    if(id&&method==="DELETE")return deleteArticle(tx,userId,id);
    throw new HttpError(404,"İşlem bulunamadı.");
  }
  if (/^\/drafts(\/|$)/.test(resourcePath)) {
    const match=/^\/drafts(?:\/([^/]+))?$/.exec(resourcePath);if(!match)throw new HttpError(404,"İşlem bulunamadı.");const id=match[1]?uuid(match[1]):undefined;
    if(!id&&method==="GET")return listTextDrafts(tx,userId,url.searchParams);
    if(!id&&method==="POST")return saveTextDraft(tx,userId,body);
    if(id&&method==="GET")return readTextDraft(tx,userId,id);
    if(id&&method==="PATCH")return saveTextDraft(tx,userId,body,id);
    if(id&&method==="DELETE")return deleteTextDraft(tx,userId,id);
    throw new HttpError(404,"İşlem bulunamadı.");
  }
  if(resourcePath==="/analytics"&&method==="GET") return creatorAnalytics(tx,userId,url.searchParams);
  if(resourcePath==="/preferences") {
    if(method==="GET")return readPreferences(tx,userId);
    if(method==="PATCH")return savePreferences(tx,userId,body);
    throw new HttpError(404,"İşlem bulunamadı.");
  }
  if (/^\/events(\/|$)/.test(resourcePath)) {
    const match=/^\/events(?:\/([^/]+)(?:\/(rsvp))?)?$/.exec(resourcePath);if(!match)throw new HttpError(404,"İşlem bulunamadı.");const id=match[1]?uuid(match[1]):undefined;
    if(!id&&method==="GET")return listEvents(tx,userId,url.searchParams);
    if(!id&&method==="POST")return saveEvent(tx,userId,body);
    if(id&&!match[2]&&method==="GET")return readEvent(tx,userId,id);
    if(id&&!match[2]&&method==="PATCH")return saveEvent(tx,userId,body,id);
    if(id&&!match[2]&&method==="DELETE")return deleteEvent(tx,userId,id);
    if(id&&match[2]&&["PUT","DELETE"].includes(method))return setEventRsvp(tx,userId,id,method==="PUT");
    throw new HttpError(404,"İşlem bulunamadı.");
  }
  // Match private resources against the unfiltered path so extra or empty segments cannot become valid routes.
  const privateParts = privateRoute(url, method);
  if (privateParts) {
    const parts = privateParts;
    if (parts[0] === "lists") {
      if (parts.length === 1 && method === "GET") return listAccountLists(tx, userId, url.searchParams.get("cursor"));
      if (parts.length === 1 && method === "POST") return saveAccountList(tx, userId, body);
      if (parts.length === 2 && parts[1] && ["GET", "PATCH", "DELETE"].includes(method)) {
        const listId = uuid(parts[1]);
        if (method === "GET") return accountList(tx, userId, listId);
        if (method === "PATCH") return saveAccountList(tx, userId, body, listId);
        return deleteAccountList(tx, userId, listId);
      }
      if (parts.length === 3 && parts[1] && method === "GET") {
        if (parts[2] === "members") return listAccountMembers(tx, userId, uuid(parts[1]), url.searchParams.get("cursor"));
        if (parts[2] === "timeline") return timeline(tx, userId, undefined, url.searchParams.get("snapshot"), url.searchParams.get("cursor"), uuid(parts[1]));
      }
      if (parts.length === 4 && parts[1] && parts[2] === "members" && parts[3] && (method === "PUT" || method === "DELETE")) {
        return setAccountMember(tx, userId, uuid(parts[1]), uuid(parts[3]), method === "PUT");
      }
    } else {
      if (parts.length === 1 && method === "GET") return listSavedSearches(tx, userId, url.searchParams.get("cursor"));
      if (parts.length === 1 && method === "POST") return saveSearch(tx, userId, body);
      if (parts.length === 2 && parts[1] && method === "DELETE") return deleteSavedSearch(tx, userId, uuid(parts[1]));
    }
    throw new HttpError(404, "İşlem bulunamadı.");
  }
  const path = url.pathname.slice(4).split("/").filter(Boolean);
  const offset = pageOffset(url.searchParams.get("page"));
  const id = path[1] && ["threads", "profiles", "communities"].includes(path[0]) ? uuid(path[1]) : undefined;
  if (path[0] === "notifications") {
    if (path.length === 1 && method === "GET") return listNotifications(tx, userId, url.searchParams.get("cursor"), url.searchParams.get("kind") || "all");
    if (path.length === 2 && path[1] === "unread" && method === "GET") return unreadNotifications(tx, userId);
    if (path.length === 2 && path[1] === "read" && method === "PATCH") return markNotificationsRead(tx, userId, body.ids);
    throw new HttpError(404, "İşlem bulunamadı.");
  }
  if (path[0] === "bookmarks" && path.length === 1 && method === "GET") {
    return listBookmarks(tx, userId, url.searchParams.get("cursor"));
  }
  if (path[0] === "threads" && id && path[2] === "bookmark") {
    if (path.length !== 3 || (method !== "PUT" && method !== "DELETE")) throw new HttpError(404, "İşlem bulunamadı.");
    return setBookmark(tx, userId, id, method === "PUT");
  }
  if(path[0]==="threads" && id && path[2]==="repost") {
    if(path.length!==3 || (method!=="PUT" && method!=="DELETE")) throw new HttpError(404,"İşlem bulunamadı.");
    return setRepost(tx,userId,id,method==="PUT");
  }
  if (path[0] === "profiles" && id && path[2]) {
    if(path.length===3 && path[2]==="timeline" && method==="GET") return timeline(tx,userId,id,url.searchParams.get("snapshot"),url.searchParams.get("cursor"));
    if (path.length === 3 && path[2] === "follow" && (method === "PUT" || method === "DELETE")) return setFollow(tx, userId, id, method === "PUT");
    if (path.length === 3 && (path[2] === "followers" || path[2] === "following") && method === "GET") return listFollows(tx, id, path[2], url.searchParams.get("cursor"));
    throw new HttpError(404, "İşlem bulunamadı.");
  }
  if (method === "GET" && path[0] === "me") {
    const allCommunities = await listCommunities(tx, userId);
    return { profile: await profile(tx, userId), communities: allCommunities.filter(c => c.joined), suggestedCommunities: allCommunities.filter(c => !c.joined).slice(0, 3) };
  }
  if (method === "PATCH" && path[0] === "me") {
    const [updated] = await tx.update(profiles).set({
      name: text(body.name, 3, 30), username: username(body.username), bio: text(body.bio ?? "", 0, 1000),
      image: avatar(body.image, userId, supabaseUrl), onboarded: true,
    }).where(eq(profiles.id, userId)).returning();
    if (!updated) throw new HttpError(404, "Profil bulunamadı.");
    return updated;
  }
  if (method === "GET" && path.length === 1 && path[0] === "explore") return explorePage(tx, userId, url.searchParams);
  if (method === "GET" && path[0] === "search") {
    const query = (url.searchParams.get("q") || "").trim().slice(0, 80).replace(/[\\%_]/g, "");
    if (!query) {
      const directory = await listCommunities(tx, userId);
      const people = await tx.select().from(profiles).where(and(eq(profiles.onboarded, true), ne(profiles.id, userId))).orderBy(desc(profiles.createdAt)).limit(8);
      return { query, posts: [], people, communities: directory.filter(community => !community.joined).slice(0, 8) };
    }
    const needle = query.toLowerCase();
    const pattern = `%${query}%`;
    const posts = (await listPosts(tx, userId, and(isNull(threads.parentId), ilike(threads.text, pattern), sql`not exists(select 1 from feed_feedback f where f.thread_id = ${threads.id} and f.user_id = ${userId})`))).slice(0, 20);
    const people = await tx.select().from(profiles).where(and(eq(profiles.onboarded, true), or(ilike(profiles.name, pattern), ilike(profiles.username, pattern)))).orderBy(profiles.username).limit(20);
    const directory = await listCommunities(tx, userId);
    const foundCommunities = directory.filter(community => [community.name, community.username, community.bio].some(value => value.toLowerCase().includes(needle))).slice(0, 20);
    return { query, posts, people, communities: foundCommunities };
  }
  if (method === "GET" && path[0] === "profiles" && id) {
    const tab = url.searchParams.get("tab") === "replies" ? "replies" : "posts";
    const scope = and(eq(threads.authorId, id), tab === "replies" ? isNotNull(threads.parentId) : isNull(threads.parentId));
    const [total] = await tx.select({ count: sql<number>`count(*)::int` }).from(threads).where(scope);
    return { profile: await profile(tx, id), ...await followState(tx, userId, id), postCount: total.count, ...page(await listPosts(tx, userId, scope, offset)) };
  }
  if (method === "GET" && path[0] === "profiles") {
    const query = (url.searchParams.get("q") || "").slice(0, 80).replace(/[\\%_]/g, "");
    return tx.select().from(profiles).where(and(eq(profiles.onboarded, true), ne(profiles.id, userId), query ? or(ilike(profiles.username, `%${query}%`), ilike(profiles.name, `%${query}%`)) : undefined)).orderBy(profiles.username).limit(30);
  }
  if (method === "GET" && path[0] === "threads" && path.length === 1) {
    const feed = url.searchParams.get("feed") || "all";
    if (!["all", "latest", "communities", "following"].includes(feed)) throw new HttpError(400, "Geçersiz akış.");
    if (feed === "all") return recommendedFeed(tx, userId, offset, url.searchParams.get("snapshot"));
    if(feed==="following") return timeline(tx,userId,undefined,url.searchParams.get("snapshot"),url.searchParams.get("cursor"));
    return page(await listPosts(tx, userId, and(isNull(threads.parentId),
      sql`not exists(select 1 from feed_feedback f where f.thread_id = ${threads.id} and f.user_id = ${userId})`,
      feed === "communities" ? sql`${threads.communityId} in (select community_id from community_members where user_id = ${userId})` : undefined), offset));
  }
  if (path[0] === "threads" && id && path.length === 3 && path[2] === "dismiss") {
    if (method === "POST") {
      await tx.insert(feedFeedback).values({ userId, threadId: id }).onConflictDoNothing();
      return { success: true };
    }
    if (method === "DELETE") {
      await tx.delete(feedFeedback).where(and(eq(feedFeedback.userId,userId), eq(feedFeedback.threadId,id)));
      return { success: true };
    }
  }
  if (method === "GET" && path[0] === "threads" && id && path.length === 2) {
    const [post] = await listPosts(tx, userId, eq(threads.id, id));
    if (!post) throw new HttpError(404, "Gönderi bulunamadı.");
    const replies = await listPosts(tx, userId, eq(threads.parentId, id), offset);
    return { post, replies: replies.slice(0, 20), hasMore: replies.length > 20 };
  }
  if (method === "POST" && path[0] === "threads" && path.length === 1) {
    const media = imageReferences(body.media, userId);
    let communityId = body.communityId ? uuid(body.communityId) : null;
    const parentId = body.parentId ? uuid(body.parentId) : null;
    if (parentId) {
      const [parent] = await tx.select().from(threads).where(eq(threads.id, parentId));
      if (!parent) throw new HttpError(404, "Gönderi bulunamadı.");
      communityId = parent.communityId;
    }
    const savedDraft = await publishingDraft(tx,userId,body,communityId,parentId);
    const [row] = await tx.insert(threads).values({ text: text(body.text ?? "", media.length ? 0 : 1, parentId ? 350 : 550), authorId: userId, communityId, parentId }).returning();
    await attachImages(tx, userId, row.id, media);
    if(savedDraft) await tx.delete(textDrafts).where(and(eq(textDrafts.id,savedDraft.id),eq(textDrafts.ownerId,userId),eq(textDrafts.version,savedDraft.version)));
    return row;
  }
  if (method === "DELETE" && path[0] === "threads" && id && path.length === 2) {
    const deleted = await tx.delete(threads).where(and(eq(threads.id, id), eq(threads.authorId, userId))).returning();
    if (!deleted.length) throw new HttpError(404, "Gönderi bulunamadı veya sana ait değil.");
    return { success: true };
  }
  if (method === "POST" && path[0] === "threads" && id && path.length === 3 && path[2] === "like") {
    const result = await tx.execute(sql`select public.toggle_thread_like(${id}::uuid) as result`);
    return (Array.isArray(result) ? result : (result as unknown as { rows: { result: unknown }[] }).rows)[0].result;
  }
  if (method === "GET" && path[0] === "communities" && !id) return listCommunities(tx, userId);
  if (method === "GET" && path[0] === "communities" && id) {
    const [community] = await listCommunities(tx, userId, id);
    if (!community) throw new HttpError(404, "Topluluk bulunamadı.");
    const memberRows = await tx.select({ profile: profiles }).from(members).innerJoin(profiles, eq(profiles.id, members.userId)).where(eq(members.communityId, id)).orderBy(profiles.name).limit(100);
    return { community, owner: await profile(tx, community.createdBy), members: memberRows.map(m => m.profile), ...page(await listPosts(tx, userId, and(eq(threads.communityId, id), isNull(threads.parentId)), offset)) };
  }
  if (method === "POST" && path[0] === "communities" && !id) {
    const [community] = await tx.insert(communities).values({ name: text(body.name, 3, 60), username: username(body.username), bio: text(body.bio ?? "", 0, 350), createdBy: userId }).returning();
    return community;
  }
  if (method === "PATCH" && path[0] === "communities" && id) {
    const [community] = await tx.update(communities).set({ bio: text(body.bio ?? "", 0, 350) }).where(and(eq(communities.id, id), eq(communities.createdBy, userId))).returning();
    if (!community) throw new HttpError(403, "Bu topluluğu düzenleyemezsin.");
    return community;
  }
  if (path[0] === "communities" && id && path[2] === "membership") {
    if (method === "POST") {
      await tx.insert(members).values({ communityId: id, userId }).onConflictDoNothing();
      return { success: true };
    }
    if (method === "DELETE") {
      const deleted = await tx.delete(members).where(and(eq(members.communityId, id), eq(members.userId, userId))).returning();
      if (!deleted.length) throw new HttpError(403, "Topluluk sahibi kendi topluluğundan ayrılamaz.");
      return { success: true };
    }
  }
  throw new HttpError(404, "İşlem bulunamadı.");
}
