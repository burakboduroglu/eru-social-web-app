import { ServerTiming } from "./timing";
import { recommendedFeed } from "./feed";
import { feedFeedback } from "./db/schema";
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
    let body: Record<string, unknown> = {};
    if (["POST", "PATCH", "PUT"].includes(request.method)) {
      try { body = object(await request.json()); } catch { throw new HttpError(400, "Geçersiz istek gövdesi."); }
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
  const path = url.pathname.slice(4).split("/").filter(Boolean);
  const offset = pageOffset(url.searchParams.get("page"));
  const id = path[1] ? uuid(path[1]) : undefined;
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
    return { profile: await profile(tx, id), postCount: total.count, ...page(await listPosts(tx, userId, scope, offset)) };
  }
  if (method === "GET" && path[0] === "profiles") {
    const query = (url.searchParams.get("q") || "").slice(0, 80).replace(/[\\%_]/g, "");
    return tx.select().from(profiles).where(and(eq(profiles.onboarded, true), ne(profiles.id, userId), query ? or(ilike(profiles.username, `%${query}%`), ilike(profiles.name, `%${query}%`)) : undefined)).orderBy(profiles.username).limit(30);
  }
  if (method === "GET" && path[0] === "notifications") {
    return page(await listPosts(tx, userId, and(ne(threads.authorId, userId), sql`${threads.createdAt} >= now() - interval '24 hours'`, sql`${threads.parentId} in (select id from threads where author_id = ${userId})`), offset));
  }
  if (method === "GET" && path[0] === "threads" && !id) {
    const feed = url.searchParams.get("feed") || "all";
    if (feed === "all") return recommendedFeed(tx, userId, offset, url.searchParams.get("snapshot"));
    return page(await listPosts(tx, userId, and(isNull(threads.parentId),
      sql`not exists(select 1 from feed_feedback f where f.thread_id = ${threads.id} and f.user_id = ${userId})`,
      feed === "communities" ? sql`${threads.communityId} in (select community_id from community_members where user_id = ${userId})` : undefined), offset));
  }
  if (path[0] === "threads" && id && path[2] === "dismiss") {
    if (method === "POST") {
      await tx.insert(feedFeedback).values({ userId, threadId: id }).onConflictDoNothing();
      return { success: true };
    }
    if (method === "DELETE") {
      await tx.delete(feedFeedback).where(and(eq(feedFeedback.userId,userId), eq(feedFeedback.threadId,id)));
      return { success: true };
    }
  }
  if (method === "GET" && path[0] === "threads" && id) {
    const [post] = await listPosts(tx, userId, eq(threads.id, id));
    if (!post) throw new HttpError(404, "Gönderi bulunamadı.");
    const replies = await listPosts(tx, userId, eq(threads.parentId, id), offset);
    return { post, replies: replies.slice(0, 20), hasMore: replies.length > 20 };
  }
  if (method === "POST" && path[0] === "threads" && !id) {
    let communityId = body.communityId ? uuid(body.communityId) : null;
    const parentId = body.parentId ? uuid(body.parentId) : null;
    if (parentId) {
      const [parent] = await tx.select().from(threads).where(eq(threads.id, parentId));
      if (!parent) throw new HttpError(404, "Gönderi bulunamadı.");
      communityId = parent.communityId;
    }
    const [row] = await tx.insert(threads).values({ text: text(body.text, 1, parentId ? 350 : 550), authorId: userId, communityId, parentId }).returning();
    return row;
  }
  if (method === "DELETE" && path[0] === "threads" && id) {
    const deleted = await tx.delete(threads).where(and(eq(threads.id, id), eq(threads.authorId, userId))).returning();
    if (!deleted.length) throw new HttpError(404, "Gönderi bulunamadı veya sana ait değil.");
    return { success: true };
  }
  if (method === "POST" && path[0] === "threads" && id && path[2] === "like") {
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
