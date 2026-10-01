import { ApiError, parseRetryAfter } from "./errors";
import { redirect } from "@tanstack/react-router";
import { supabase } from "./supabase";
import { RequestCache } from "./request-cache";
import { allocateResponseVersion, tagResponseVersion } from "./response-version";

const cache = new RequestCache(100);
export function invalidateApiCache(includeProfile = false) {
  cache.invalidate(key => includeProfile || !key.endsWith(":/me"));
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { invalidateApiCache(true); throw redirect({ to: "/sign-in" }); }
  const userKey = session.user?.id || session.access_token;
  const request = async () => {
    const version = allocateResponseVersion();
    const response = await fetch(`/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { invalidateApiCache(true); throw redirect({ to: "/sign-in" }); }
    if (!response.ok) throw new ApiError(response.status, data.error || "İşlem tamamlanamadı.", parseRetryAfter(response.headers.get("Retry-After")));
    return tagResponseVersion(data, version) as T;
  };
  if (method === "GET") return cache.get(`${userKey}:${path}`, path === "/me" ? 60_000 : 15_000, request);
  const data = await request();
  // A post/like should not refetch the shell's profile and community list.
  // Profile and membership edits do refresh that context immediately.
  invalidateApiCache(path === "/me" || path.startsWith("/communities"));
  return data;
}
