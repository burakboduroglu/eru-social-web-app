export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Geçersiz istek.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `Metin ${min}–${max} karakter olmalı.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, "Geçersiz kimlik.");
  return value;
}
export function username(value: unknown) {
  const name = text(value, 3, 30).toLowerCase();
  if (!/^[a-z0-9_]+$/.test(name)) throw new HttpError(400, "Kullanıcı adında küçük harf, rakam ve alt çizgi kullan.");
  return name;
}
export function pageOffset(value: string | null) {
  const page = Number(value || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new HttpError(400, "Geçersiz sayfa.");
  return page * 20;
}
export function avatar(value: unknown, userId: string, supabaseUrl: string) {
  if (!value) return "";
  const url = text(value, 1, 1000);
  const prefix = `${supabaseUrl}/storage/v1/object/public/avatars/${userId}/`;
  if (!url.startsWith(prefix) || /[?#]/.test(url)) throw new HttpError(400, "Geçersiz profil görseli.");
  return url;
}
