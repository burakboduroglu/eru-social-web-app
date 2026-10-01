import { and, desc, eq, sql } from "drizzle-orm";
import { savedSearches } from "./db/schema";
import type { Transaction } from "./db/client";
import type { SavedSearch, SavedSearchesPage } from "../shared/types";
import { decodeCursor, encodeCursor } from "./cursor";
import { HttpError, text } from "./validation";

const fields = {
  id: savedSearches.id, ownerId: savedSearches.ownerId, query: savedSearches.query, tab: savedSearches.tab,
  createdAt: sql<string>`to_char(${savedSearches.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
};
export async function listSavedSearches(tx: Transaction, userId: string, value: string | null): Promise<SavedSearchesPage> {
  const cursor = decodeCursor(value);
  const rows = await tx.select(fields).from(savedSearches).where(and(eq(savedSearches.ownerId, userId), cursor
    ? sql`(${savedSearches.createdAt},${savedSearches.id}) < (${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : undefined
  )).orderBy(desc(savedSearches.createdAt), desc(savedSearches.id)).limit(21);
  const searches = rows.slice(0, 20), last = searches.at(-1);
  return { searches, nextCursor: rows.length > 20 && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}
export async function saveSearch(tx: Transaction, userId: string, body: Record<string, unknown>): Promise<SavedSearch> {
  const query = text(typeof body.query === "string" ? body.query.replace(/\s+/g, " ") : body.query, 2, 80);
  const tab = body.tab;
  if (tab !== "posts" && tab !== "people" && tab !== "communities") throw new HttpError(400, "Geçersiz arama sekmesi.");
  const [inserted] = await tx.insert(savedSearches).values({ ownerId: userId, query, tab }).onConflictDoNothing().returning(fields);
  if (inserted) return inserted;
  const [existing] = await tx.select(fields).from(savedSearches).where(and(
    eq(savedSearches.ownerId, userId), eq(savedSearches.tab, tab),
    sql`${savedSearches.normalizedQuery}=lower(public.normalize_saved_query(${query}))`,
  ));
  if (!existing) throw new HttpError(409, "Arama değişti. Tekrar kaydedebilirsin.");
  return existing;
}
export async function deleteSavedSearch(tx: Transaction, userId: string, id: string) {
  const deleted = await tx.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.ownerId, userId))).returning({ id: savedSearches.id });
  if (!deleted.length) throw new HttpError(404, "Kayıtlı arama bulunamadı.");
  return { success: true };
}
