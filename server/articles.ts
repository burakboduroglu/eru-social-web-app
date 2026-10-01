import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { articles, profiles } from "./db/schema";
import type { Transaction } from "./db/client";
import type { Article, ResourcePage } from "../shared/types";
import { HttpError, text } from "./validation";
import { enumValue, versionValue } from "./content-validation";
import { scopedCursor, nextScopedCursor } from "./scoped-cursor";
const fields = { ...getTableColumns(articles), createdAt: sql<string> `to_char(${articles.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, publisher: profiles };
export async function readArticle(tx: Transaction, id: string): Promise<Article> {
    const [row] = await tx.select(fields).from(articles).innerJoin(profiles, eq(profiles.id, articles.ownerId)).where(eq(articles.id, id));
    if (!row)
        throw new HttpError(404, "Yazı bulunamadı.");
    return row;
}
export async function listArticles(tx: Transaction, userId: string, p: URLSearchParams): Promise<ResourcePage<Article>> {
    const filter = enumValue(p.get("filter") || "all", ["all", "mine"]), scope = JSON.stringify([userId, filter]), c = scopedCursor(p.get("cursor"), scope);
    const rows = await tx.select({ ...fields, body: sql<string> `''` }).from(articles).innerJoin(profiles, eq(profiles.id, articles.ownerId)).where(and(filter === "mine" ? eq(articles.ownerId, userId) : eq(articles.status, "published"), c ? sql `(${articles.createdAt},${articles.id})<(${c.createdAt}::timestamptz,${c.id}::uuid)` : undefined)).orderBy(desc(articles.createdAt), desc(articles.id)).limit(21);
    const items = rows.slice(0, 20), last = items.at(-1);
    return { items, nextCursor: rows.length > 20 && last ? nextScopedCursor(scope, last) : null };
}
export async function saveArticle(tx: Transaction, userId: string, b: Record<string, unknown>, id?: string): Promise<Article> {
    const values = { title: text(b.title, 1, 120), summary: text(b.summary ?? "", 0, 350), body: text(b.body, 1, 50000) };
    let row;
    if (id) {
        const old = await readArticle(tx, id);
        if (old.ownerId !== userId)
            throw new HttpError(404, "Yazı bulunamadı.");
        const status = enumValue(b.status, ["draft", "published"]);
        if (old.status === "published" && status !== "published")
            throw new HttpError(400, "Yayınlanan yazı taslağa dönüştürülemez.");
        [row] = await tx.update(articles).set({ ...values, status }).where(and(eq(articles.id, id), eq(articles.ownerId, userId), eq(articles.version, versionValue(b.version)))).returning({ id: articles.id });
        if (!row)
            throw new HttpError(409, "Yazı başka bir oturumda değişti. Metnini koruyup güncel sürümü aç.");
    }
    else
        [row] = await tx.insert(articles).values({ ...values, ownerId: userId, status: "draft" }).returning({ id: articles.id });
    return readArticle(tx, row.id);
}
export async function deleteArticle(tx: Transaction, userId: string, id: string) {
    const rows = await tx.delete(articles).where(and(eq(articles.id, id), eq(articles.ownerId, userId))).returning({ id: articles.id });
    if (!rows.length)
        throw new HttpError(404, "Yazı bulunamadı.");
    return { success: true };
}
