import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { communities, discussionEntries as entries, discussionSubjects as subjects, members, profiles, subjectFollows, subjectSaves } from "./db/schema";
import type { Transaction } from "./db/client";
import type { CreateSubjectResult, Subject, SubjectEntryPage, SubjectPage } from "../shared/discussion-types";
import { enumValue, versionValue } from "./content-validation";
import { nextScopedCursor, scopedCursor } from "./scoped-cursor";
import { HttpError, text, uuid } from "./validation";

const timestamp = (column: typeof subjects.createdAt | typeof entries.createdAt) => sql<string>`to_char(${column} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const subjectFields = (userId: string) => ({
  id: subjects.id, communityId: subjects.communityId, title: subjects.title,
  createdBy: subjects.createdBy, status: subjects.status, version: subjects.version,
  createdAt: timestamp(subjects.createdAt), updatedAt: subjects.updatedAt, community: communities,
  joined: sql<boolean>`exists(select 1 from community_members m where m.community_id=${subjects.communityId} and m.user_id=${userId})`,
  canModerate: sql<boolean>`${communities.createdBy}=${userId}::uuid`,
  entryCount: sql<number>`(select count(*)::int from discussion_entries e where e.subject_id=${subjects.id})`,
  latestEntryAt: sql<string | null>`(select max(e.created_at) from discussion_entries e where e.subject_id=${subjects.id})`,
  following: sql<boolean>`exists(select 1 from subject_follows f where f.subject_id=${subjects.id} and f.user_id=${userId})`,
  saved: sql<boolean>`exists(select 1 from subject_saves s where s.subject_id=${subjects.id} and s.user_id=${userId})`,
});
const querySubjects = (tx: Transaction, userId: string) => tx.select(subjectFields(userId)).from(subjects).innerJoin(communities, eq(communities.id, subjects.communityId));

export async function readSubject(tx: Transaction, userId: string, id: string): Promise<Subject> {
  const [row] = await querySubjects(tx, userId).where(eq(subjects.id, id));
  if (!row) throw new HttpError(404, "Başlık bulunamadı veya topluluk artık kullanılamıyor.");
  return row;
}

export async function listSubjects(tx: Transaction, userId: string, params: URLSearchParams): Promise<SubjectPage> {
  const q = (params.get("q") || "").trim().slice(0, 120);
  const communityId = params.get("communityId") ? uuid(params.get("communityId")) : null;
  const filter = enumValue(params.get("filter") || "all", ["all", "following", "saved"]);
  const scope = JSON.stringify([userId, "subjects", q, communityId, filter]);
  const cursor = scopedCursor(params.get("cursor"), scope);
  const pattern = `%${q.replace(/[\\%_]/g, character => `\\${character}`)}%`;
  const rows = await querySubjects(tx, userId).where(and(
    q ? ilike(subjects.title, pattern) : undefined,
    communityId ? eq(subjects.communityId, communityId) : undefined,
    filter === "following" ? sql`exists(select 1 from subject_follows f where f.subject_id=${subjects.id} and f.user_id=${userId})` : filter === "saved" ? sql`exists(select 1 from subject_saves s where s.subject_id=${subjects.id} and s.user_id=${userId})` : undefined,
    cursor ? sql`(${subjects.createdAt},${subjects.id})<(${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : undefined,
  )).orderBy(desc(subjects.createdAt), desc(subjects.id)).limit(21);
  const items = rows.slice(0, 20), last = items.at(-1);
  return { items, nextCursor: rows.length > 20 && last ? nextScopedCursor(scope, last) : null };
}

export async function createOrReuseSubject(tx: Transaction, userId: string, body: Record<string, unknown>): Promise<CreateSubjectResult> {
  const communityId = uuid(body.communityId);
  const title = text(typeof body.title === "string" ? body.title.replace(/\s+/g, " ") : body.title, 3, 120);
  const [membership] = await tx.select({ id: communities.id }).from(communities).innerJoin(members, and(eq(members.communityId, communities.id), eq(members.userId, userId))).where(eq(communities.id, communityId));
  if (!membership) throw new HttpError(403, "Başlık oluşturmak için topluluğa katılmalısın.");
  const [inserted] = await tx.insert(subjects).values({ title, communityId, createdBy: userId }).onConflictDoNothing().returning({ id: subjects.id });
  if (inserted) return { subject: await readSubject(tx, userId, inserted.id), reused: false };
  const [existing] = await tx.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.communityId, communityId), sql`${subjects.normalizedTitle}=lower(public.normalize_subject_title(${title}))`));
  if (!existing) throw new HttpError(409, "Başlık değişti. Yeniden açmayı deneyebilirsin.");
  return { subject: await readSubject(tx, userId, existing.id), reused: true };
}

export async function setSubjectStatus(tx: Transaction, userId: string, id: string, body: Record<string, unknown>): Promise<Subject> {
  const status = enumValue(body.status, ["open", "locked"]), version = versionValue(body.version);
  const [row] = await tx.select({ communityId: subjects.communityId, version: subjects.version }).from(subjects).where(eq(subjects.id, id)).for("update");
  if (!row) throw new HttpError(404, "Başlık bulunamadı veya bu başlığı yönetemezsin.");
  const [community] = await tx.select({ id: communities.id }).from(communities).where(and(eq(communities.id, row.communityId), eq(communities.createdBy, userId)));
  if (!community) throw new HttpError(403, "Başlığı yalnızca topluluk sahibi yönetebilir.");
  if (row.version !== version) throw new HttpError(409, "Başlık başka bir oturumda değişti. Güncel durumu yükleyip tekrar dene.");
  const updated = await tx.update(subjects).set({ status }).where(and(eq(subjects.id, id), eq(subjects.version, version))).returning({ id: subjects.id });
  if (!updated.length) throw new HttpError(409, "Başlık değişti. Güncel durumu yeniden yükle.");
  return readSubject(tx, userId, id);
}

export async function listEntries(tx: Transaction, userId: string, id: string, value: string | null): Promise<SubjectEntryPage> {
  await readSubject(tx, userId, id);
  const scope = JSON.stringify([userId, "subject-entries", id, "oldest"]);
  const cursor = scopedCursor(value, scope);
  const rows = await tx.select({ id: entries.id, subjectId: entries.subjectId, authorId: entries.authorId, body: entries.body, createdAt: timestamp(entries.createdAt), author: profiles }).from(entries).innerJoin(profiles, eq(profiles.id, entries.authorId)).where(and(eq(entries.subjectId, id), cursor ? sql`(${entries.createdAt},${entries.id})>(${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : undefined)).orderBy(asc(entries.createdAt), asc(entries.id)).limit(21);
  const items = rows.slice(0, 20), last = items.at(-1);
  return { items, nextCursor: rows.length > 20 && last ? nextScopedCursor(scope, last) : null };
}

export async function createEntry(tx: Transaction, userId: string, id: string, body: Record<string, unknown>) {
  const subject = await readSubject(tx, userId, id);
  if (!subject.joined) throw new HttpError(403, "Görüşünü eklemek için topluluğa katılmalısın.");
  if (subject.status !== "open") throw new HttpError(409, "Bu başlık yeni görüşlere kapalı. Metnin korunuyor.");
  const [row] = await tx.insert(entries).values({ subjectId: id, authorId: userId, body: text(body.body, 1, 2000) }).returning({ id: entries.id });
  return row;
}

export async function deleteEntry(tx: Transaction, userId: string, id: string, entryId: string) {
  const deleted = await tx.delete(entries).where(and(eq(entries.id, entryId), eq(entries.subjectId, id))).returning({ id: entries.id });
  if (!deleted.length) throw new HttpError(404, "Görüş bulunamadı veya silme yetkin yok.");
  return { success: true };
}

async function setRelationship(tx: Transaction, userId: string, id: string, enabled: boolean, table: typeof subjectFollows | typeof subjectSaves) {
  if (enabled) {
    await readSubject(tx, userId, id);
    await tx.insert(table).values({ userId, subjectId: id }).onConflictDoNothing();
  } else await tx.delete(table).where(and(eq(table.userId, userId), eq(table.subjectId, id)));
}

export async function setSubjectFollow(tx: Transaction, userId: string, id: string, enabled: boolean) {
  await setRelationship(tx, userId, id, enabled, subjectFollows);
  return { following: enabled };
}

export async function setSubjectSave(tx: Transaction, userId: string, id: string, enabled: boolean) {
  await setRelationship(tx, userId, id, enabled, subjectSaves);
  return { saved: enabled };
}
