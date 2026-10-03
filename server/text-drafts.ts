import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { textDrafts, threads, members, communities, jobs } from "./db/schema";
import type { Transaction } from "./db/client";
import type { TextDraft, ResourcePage } from "../shared/types";
import { HttpError, text, uuid } from "./validation";
import { enumValue, versionValue } from "./content-validation";
import { scopedCursor, nextScopedCursor } from "./scoped-cursor";
import { jobReferenceSelection, publishedJobReference } from "./job-shares";
const fields = { ...getTableColumns(textDrafts), jobReference: jobReferenceSelection(textDrafts.resourceKind), createdAt: sql<string> `to_char(${textDrafts.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` };
export async function draftAvailability(tx: Transaction, userId: string, context: TextDraft["context"], targetId: string | null) {
    if (context === "personal")
        return { available: true, unavailableReason: null };
    let communityId = targetId;
    if (context === "reply") {
        const [parent] = await tx.select({ communityId: threads.communityId }).from(threads).where(eq(threads.id, targetId!));
        if (!parent)
            return { available: false, unavailableReason: "Yanıtlanan gönderi artık kullanılamıyor. Metnini kopyalayabilir veya taslağı silebilirsin." };
        communityId = parent.communityId;
    }
    if (communityId) {
        const [member] = await tx.select({ id: communities.id }).from(communities).innerJoin(members, and(eq(members.communityId, communities.id), eq(members.userId, userId))).where(eq(communities.id, communityId));
        if (!member)
            return { available: false, unavailableReason: "Topluluk artık kullanılamıyor veya üyesi değilsin. Metnin taslakta korunuyor." };
    }
    return { available: true, unavailableReason: null };
}
export async function readTextDraft(tx: Transaction, userId: string, id: string, lock = false): Promise<TextDraft> {
    const query = tx.select(fields).from(textDrafts).leftJoin(jobs, and(eq(textDrafts.jobId, jobs.id), sql`${jobs.status}<>'draft'`)).where(and(eq(textDrafts.id, id), eq(textDrafts.ownerId, userId)));
    const [row] = await (lock ? query.for("update", { of: textDrafts }) : query);
    if (!row)
        throw new HttpError(404, "Taslak bulunamadı.");
    return { ...row, ...await draftAvailability(tx, userId, row.context, row.targetId) };
}
export async function listTextDrafts(tx: Transaction, userId: string, p: URLSearchParams): Promise<ResourcePage<TextDraft>> {
    const scope = JSON.stringify([userId, "drafts"]), c = scopedCursor(p.get("cursor"), scope);
    const rows = await tx.select(fields).from(textDrafts).leftJoin(jobs, and(eq(textDrafts.jobId, jobs.id), sql`${jobs.status}<>'draft'`)).where(and(eq(textDrafts.ownerId, userId), c ? sql `(${textDrafts.createdAt},${textDrafts.id})<(${c.createdAt}::timestamptz,${c.id}::uuid)` : undefined)).orderBy(desc(textDrafts.createdAt), desc(textDrafts.id)).limit(21);
    const items = await Promise.all(rows.slice(0, 20).map(async (row) => ({ ...row, ...await draftAvailability(tx, userId, row.context, row.targetId) }))), last = items.at(-1);
    return { items, nextCursor: rows.length > 20 && last ? nextScopedCursor(scope, last) : null };
}
export async function saveTextDraft(tx: Transaction, userId: string, b: Record<string, unknown>, id?: string): Promise<TextDraft> {
    const context = enumValue(b.context, ["personal", "community", "reply"]), targetId = context === "personal" ? null : uuid(b.targetId), availability = await draftAvailability(tx, userId, context, targetId);
    if (!availability.available)
        throw new HttpError(400, availability.unavailableReason!);
    const prior = id ? await readTextDraft(tx, userId, id) : undefined;
    let reference: { resourceKind: "job" | null; jobId: string | null } = { resourceKind: prior?.resourceKind || null, jobId: prior?.jobId || null };
    if (Object.hasOwn(b, "jobId")) {
        if (b.jobId === null && b.resourceKind === "job" && prior?.resourceKind === "job" && !prior.jobId) reference = { resourceKind: "job", jobId: null };
        else if (b.jobId && prior?.resourceKind === "job" && b.jobId === prior.jobId) reference = { resourceKind: "job", jobId: prior.jobId || null };
        else reference = await publishedJobReference(tx, b.jobId);
    }
    if (context === "reply" && reference.resourceKind) throw new HttpError(400, "İlan eki yalnızca kişisel veya topluluk gönderilerinde kullanılabilir.");
    const values = { context, targetId, text: text(b.text, 1, context === "reply" ? 350 : 550), ...reference };
    let row;
    if (id) {
        [row] = await tx.update(textDrafts).set(values).where(and(eq(textDrafts.id, id), eq(textDrafts.ownerId, userId), eq(textDrafts.version, versionValue(b.version)))).returning({ id: textDrafts.id });
        if (!row)
            throw new HttpError(409, "Taslak başka bir oturumda değişti. Metnin korunuyor.");
    }
    else
        [row] = await tx.insert(textDrafts).values({ ...values, ownerId: userId }).returning({ id: textDrafts.id });
    return readTextDraft(tx, userId, row.id);
}
export async function deleteTextDraft(tx: Transaction, userId: string, id: string) {
    const rows = await tx.delete(textDrafts).where(and(eq(textDrafts.id, id), eq(textDrafts.ownerId, userId))).returning({ id: textDrafts.id });
    if (!rows.length)
        throw new HttpError(404, "Taslak bulunamadı.");
    return { success: true };
}
export async function publishingDraft(tx: Transaction, userId: string, b: Record<string, unknown>, communityId: string | null, parentId: string | null) {
    if (!b.draftId)
        return null;
    const draft = await readTextDraft(tx, userId, uuid(b.draftId), true);
    if (draft.version !== versionValue(b.draftVersion))
        throw new HttpError(409, "Taslak başka bir oturumda değişti. Güncel taslağı yeniden aç.");
    const context = parentId ? "reply" : communityId ? "community" : "personal", targetId = parentId || communityId;
    if (!draft.available || draft.context !== context || draft.targetId !== targetId)
        throw new HttpError(400, draft.unavailableReason || "Taslağın paylaşım yeri değişti. Önce taslağı yeniden kaydet.");
    return draft;
}
