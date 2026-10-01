import { createClient } from "@supabase/supabase-js";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDatabase, type Transaction } from "./db/client";
import { mediaUploads, threadMedia } from "./db/schema";
import { inspectImage, type ImageMetadata } from "./image-validation";
import { HttpError, object, text } from "./validation";
import type { UploadImageResult } from "../shared/types";

export type ImageStorage = {
  upload(path: string, bytes: Uint8Array, type: string): Promise<void>;
  download(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
};
export function imageStorage(config: { url: string; publishableKey: string }, bearer: string): ImageStorage {
  const boundedFetch = ((input: string | URL | Request, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) })) as typeof fetch;
  const bucket = createClient(config.url, config.publishableKey, { global: { headers: { Authorization: bearer }, fetch: boundedFetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage.from("post-images");
  return {
    async upload(path, bytes, contentType) {
      const { error } = await bucket.upload(path, bytes, { contentType, upsert: false });
      if (error) throw new HttpError(503, "Görsel yüklenemedi. Tekrar deneyebilirsin.");
    },
    async download(path) {
      const { data, error } = await bucket.download(path);
      if (error || !data) throw new HttpError(400, "Yüklenen görsel bulunamadı.");
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(path) {
      const { error } = await bucket.remove([path]);
      if (error) throw new HttpError(503, "Görsel silinemedi. Tekrar deneyebilirsin.");
    },
  };
}
export function ownImagePath(value: unknown, userId: string) {
  if (typeof value !== "string" || !new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpeg|png|webp)$`).test(value)) throw new HttpError(400, "Geçersiz görsel yolu.");
  return value;
}

// Only this trusted ingestion/cleanup path uses the privileged connection.
// Ordinary caller-role transactions cannot forge accepted image metadata.
export async function registerValidatedImage(tx: Transaction, userId: string, path: string, metadata: ImageMetadata, download: () => Promise<Uint8Array>) {
  ownImagePath(path, userId);
  const result = await tx.execute(sql`select id from storage.objects where bucket_id='post-images' and name=${path} for key share`);
  const rows = (Array.isArray(result) ? result : (result as unknown as { rows: { id: string }[] }).rows) as { id: string }[];
  if (rows.length !== 1) throw new HttpError(400, "Yüklenen görsel bulunamadı.");
  // The row lock prevents concurrent Storage DELETE/replacement while validating.
  const stored = await download();
  if (stored.length !== metadata.byteSize || createHash("sha256").update(stored).digest("hex") !== metadata.sha256) throw new HttpError(400, "Yüklenen görsel değişti. Tekrar yükle.");
  await tx.insert(mediaUploads).values({ objectPath: path, ownerId: userId, storageObjectId: rows[0].id, ...metadata });
}
type RegisterImage = (userId: string, path: string, metadata: ImageMetadata, download: () => Promise<Uint8Array>) => Promise<void>;
export async function ingestImage(userId: string, bytes: Uint8Array, claimedType: string, storage: ImageStorage, supabaseUrl: string, register: RegisterImage = (owner, path, metadata, download) => getDatabase().transaction(tx => registerValidatedImage(tx, owner, path, metadata, download))): Promise<UploadImageResult> {
  const metadata = inspectImage(bytes, claimedType);
  const extension = metadata.mimeType.split("/")[1];
  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
  await storage.upload(objectPath, bytes, metadata.mimeType);
  try {
    await register(userId, objectPath, metadata, () => storage.download(objectPath));
  } catch (error) {
    try { await storage.remove(objectPath); } catch { /* Unregistered upload cleanup is best effort. */ }
    throw error;
  }
  return { objectPath, url: `${supabaseUrl}/storage/v1/object/public/post-images/${objectPath}`, mimeType: metadata.mimeType, byteSize: metadata.byteSize, width: metadata.width, height: metadata.height };
}

export async function beginImageCleanup(tx: Transaction, userId: string, path: string) {
  ownImagePath(path, userId);
  const [upload] = await tx.select().from(mediaUploads).where(and(eq(mediaUploads.ownerId, userId), eq(mediaUploads.objectPath, path))).for("update");
  if (!upload) return;
  const [reference] = await tx.select({ id: threadMedia.id }).from(threadMedia).where(eq(threadMedia.objectPath, path)).limit(1);
  if (reference) throw new HttpError(409, "Bu görsel bir gönderide kullanılıyor.");
  await tx.update(mediaUploads).set({ cleanupPending: true, storageObjectId: null }).where(and(eq(mediaUploads.ownerId, userId), eq(mediaUploads.objectPath, path)));
}
export async function removeImageRegistration(tx: Transaction, userId: string, path: string) {
  ownImagePath(path, userId);
  await tx.delete(mediaUploads).where(and(eq(mediaUploads.ownerId, userId), eq(mediaUploads.objectPath, path), eq(mediaUploads.cleanupPending, true)));
}
export async function removeImage(userId: string, value: unknown, storage: ImageStorage,
  begin: (owner: string, path: string) => Promise<void> = (owner, path) => getDatabase().transaction(tx => beginImageCleanup(tx, owner, path)),
  finish: (owner: string, path: string) => Promise<void> = (owner, path) => getDatabase().transaction(tx => removeImageRegistration(tx, owner, path))) {
  const path = ownImagePath(value, userId);
  await begin(userId, path);
  await storage.remove(path);
  await finish(userId, path);
  return { success: true };
}
export async function oldImageRegistrations(tx: Transaction, userId: string) {
  return tx.select({ path: mediaUploads.objectPath }).from(mediaUploads).where(and(
    eq(mediaUploads.ownerId, userId), sql`(${mediaUploads.createdAt} < now() - interval '24 hours' or ${mediaUploads.cleanupPending})`,
    sql`not exists(select 1 from thread_media m where m.object_path=${mediaUploads.objectPath})`,
  )).orderBy(mediaUploads.createdAt).limit(20);
}
export async function cleanupOldImages(userId: string, storage: ImageStorage,
  find: (owner: string) => Promise<{ path: string }[]> = owner => getDatabase().transaction(tx => oldImageRegistrations(tx, owner)),
  remove: (owner: string, path: string, store: ImageStorage) => Promise<unknown> = removeImage) {
  const candidates = await find(userId);
  let removed = 0, failed = 0;
  for (const item of candidates) {
    try { await remove(userId, item.path, storage); removed += 1; } catch { failed += 1; }
  }
  return { removed, failed };
}

export function imageReferences(value: unknown, userId: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) throw new HttpError(400, "En fazla dört görsel ekleyebilirsin.");
  const references = value.map(item => {
    const row = object(item);
    return { objectPath: ownImagePath(row.objectPath, userId), altText: text(row.altText ?? "", 0, 1000) };
  });
  if (new Set(references.map(item => item.objectPath)).size !== references.length) throw new HttpError(400, "Aynı görseli yalnızca bir kez ekleyebilirsin.");
  return references;
}
export async function attachImages(tx: Transaction, userId: string, threadId: string, references: ReturnType<typeof imageReferences>) {
  for (const [position, reference] of references.entries()) {
    const [upload] = await tx.select().from(mediaUploads).where(and(eq(mediaUploads.objectPath, reference.objectPath), eq(mediaUploads.ownerId, userId)));
    if (!upload || upload.cleanupPending) throw new HttpError(400, "Görsel doğrulanamadı. Tekrar yükle.");
    await tx.insert(threadMedia).values({ threadId, ownerId: userId, objectPath: upload.objectPath, mimeType: upload.mimeType, byteSize: upload.byteSize, width: upload.width, height: upload.height, altText: reference.altText, position });
  }
}
