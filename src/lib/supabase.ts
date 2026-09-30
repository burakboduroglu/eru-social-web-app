import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export let supabase: SupabaseClient;
export async function initializeAuth() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Supabase bağlantı ayarları yüklenemedi.");
  const config = await response.json() as { url: string; publishableKey: string };
  supabase = createClient(config.url, config.publishableKey, { auth: { flowType: "pkce", detectSessionInUrl: false } });
}
export async function uploadAvatar(file: File) {
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (!types[file.type] || file.size > 5 * 1024 * 1024) throw new Error("En fazla 5 MB JPEG, PNG veya WebP yükleyebilirsin.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Tekrar giriş yapmalısın.");
  const path = `${user.id}/${crypto.randomUUID()}.${types[file.type]}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file);
  if (error) throw new Error("Görsel yüklenemedi.");
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
