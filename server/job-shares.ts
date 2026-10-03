import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { jobs } from "./db/schema";
import type { Transaction } from "./db/client";
import type { JobReference } from "../shared/types";
import { HttpError, uuid } from "./validation";

/** Used with a viewer-scoped LEFT JOIN to jobs; drafts never enter the projection. */
export function jobReferenceSelection(resourceKind: AnyPgColumn) {
    return sql<JobReference | null>`case when ${resourceKind} is null then null
      when ${jobs.id} is null then json_build_object('state','unavailable')
      else json_build_object('state','available','job',json_build_object(
        'id',${jobs.id},'title',${jobs.title},'company',${jobs.company},'location',${jobs.location},
        'workMode',${jobs.workMode},'employmentType',${jobs.employmentType},'status',${jobs.status},'deadline',${jobs.deadline}
      )) end`;
}
export async function publishedJobReference(tx: Transaction, value: unknown) {
    if (value === null || value === undefined || value === "") return { resourceKind: null, jobId: null };
    const id = uuid(value);
    // Serialize publication with close/delete and reject the owner's private drafts too.
    const [job] = await tx.select({ id: jobs.id, status: jobs.status }).from(jobs).where(and(eq(jobs.id, id), eq(jobs.status, "published"))).for("share");
    if (!job) throw new HttpError(409, "İlan artık paylaşılabilir durumda değil. Metnini koruyup ilan ekini kaldırabilir veya başka bir ilan seçebilirsin.");
    return { resourceKind: "job" as const, jobId: job.id };
}
