import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { jobs, jobSaves, profiles } from "./db/schema";
import type { Transaction } from "./db/client";
import type { Job, ResourcePage } from "../shared/types";
import { HttpError, text } from "./validation";
import { enumValue, externalHttps, utcDate, versionValue } from "./content-validation";
import { scopedCursor, nextScopedCursor } from "./scoped-cursor";
const fields = { ...getTableColumns(jobs), createdAt: sql<string> `to_char(${jobs.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, publisher: profiles };
const selection = (userId: string) => ({ ...fields, saved: sql<boolean> `exists(select 1 from job_saves s where s.job_id=${jobs.id} and s.user_id=${userId})` });
export async function readJob(tx: Transaction, userId: string, id: string): Promise<Job> {
    const [row] = await tx.select(selection(userId)).from(jobs).innerJoin(profiles, eq(profiles.id, jobs.ownerId)).where(eq(jobs.id, id));
    if (!row)
        throw new HttpError(404, "İlan bulunamadı.");
    return row;
}
export async function listJobs(tx: Transaction, userId: string, p: URLSearchParams): Promise<ResourcePage<Job>> {
    const q = (p.get("q") || "").trim().slice(0, 120), location = (p.get("location") || "").trim().slice(0, 120), mode = p.get("mode") || "", type = p.get("type") || "", filter = p.get("filter") || "all";
    if (mode)
        enumValue(mode, ["onsite", "remote", "hybrid"]);
    if (type)
        enumValue(type, ["full-time", "part-time", "contract", "internship"]);
    enumValue(filter, ["all", "saved", "mine"]);
    const scope = JSON.stringify([userId, q, location, mode, type, filter]), c = scopedCursor(p.get("cursor"), scope), pattern = (v: string) => `%${v.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
    const rows = await tx.select(selection(userId)).from(jobs).innerJoin(profiles, eq(profiles.id, jobs.ownerId)).where(and(filter === "mine" ? eq(jobs.ownerId, userId) : sql `${jobs.status}<>'draft'`, filter === "saved" ? sql `exists(select 1 from job_saves s where s.job_id=${jobs.id} and s.user_id=${userId})` : undefined, q ? or(ilike(jobs.title, pattern(q)), ilike(jobs.company, pattern(q))) : undefined, location ? ilike(jobs.location, pattern(location)) : undefined, mode ? eq(jobs.workMode, mode as Job["workMode"]) : undefined, type ? eq(jobs.employmentType, type as Job["employmentType"]) : undefined, c ? sql `(${jobs.createdAt},${jobs.id})<(${c.createdAt}::timestamptz,${c.id}::uuid)` : undefined)).orderBy(desc(jobs.createdAt), desc(jobs.id)).limit(21);
    const items = rows.slice(0, 20), last = items.at(-1);
    return { items, nextCursor: rows.length > 20 && last ? nextScopedCursor(scope, last) : null };
}
export async function saveJob(tx: Transaction, userId: string, b: Record<string, unknown>, id?: string): Promise<Job> {
    const values = { title: text(b.title, 1, 120), company: text(b.company, 1, 120), location: text(b.location ?? "", 0, 120), description: text(b.description, 1, 20000), workMode: enumValue(b.workMode, ["onsite", "remote", "hybrid"]), employmentType: enumValue(b.employmentType, ["full-time", "part-time", "contract", "internship"]), applicationUrl: externalHttps(b.applicationUrl), deadline: utcDate(b.deadline, true) };
    let row;
    if (id) {
        const prior = await readJob(tx, userId, id);
        if (prior.ownerId !== userId)
            throw new HttpError(404, "İlan bulunamadı.");
        const status = enumValue(b.status, ["draft", "published", "closed"]);
        if (prior.status !== "draft" && status === "draft" || prior.status === "closed" && status !== "closed")
            throw new HttpError(400, "İlan bu duruma taşınamaz.");
        [row] = await tx.update(jobs).set({ ...values, status }).where(and(eq(jobs.id, id), eq(jobs.ownerId, userId), eq(jobs.version, versionValue(b.version)))).returning({ id: jobs.id });
        if (!row)
            throw new HttpError(409, "İlan başka bir oturumda değişti. Metnini koruyup güncel sürümü aç.");
    }
    else {
        [row] = await tx.insert(jobs).values({ ...values, ownerId: userId, status: "draft" }).returning({ id: jobs.id });
    }
    return readJob(tx, userId, row.id);
}
export async function deleteJob(tx: Transaction, userId: string, id: string) {
    const rows = await tx.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.ownerId, userId))).returning({ id: jobs.id });
    if (!rows.length)
        throw new HttpError(404, "İlan bulunamadı.");
    return { success: true };
}
export async function setJobSave(tx: Transaction, userId: string, id: string, save: boolean) {
    if (save) {
        const job = await readJob(tx, userId, id);
        if (job.status === "draft")
            throw new HttpError(400, "Taslak ilan kaydedilemez.");
        await tx.insert(jobSaves).values({ userId, jobId: id }).onConflictDoNothing();
    }
    else
        await tx.delete(jobSaves).where(and(eq(jobSaves.userId, userId), eq(jobSaves.jobId, id)));
    return { saved: save };
}
