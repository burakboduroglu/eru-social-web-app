import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";

export function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("[YOUR-PASSWORD]")) throw new Error("DATABASE_URL requires the Supabase database password.");
  return url;
}
let database: ReturnType<typeof connect> | undefined;
function connect() {
  const client = postgres(databaseUrl(), { prepare: false, ssl: "require", max: 5, connect_timeout: 10, idle_timeout: 20 });
  return drizzle(client, { schema });
}
export function getDatabase() { return database ??= connect(); }
export type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

// The pooler connection is privileged. Every application query MUST run here.
// LOCAL settings are scoped to this transaction and cannot leak across users.
export async function withUser<T>(userId: string, callback: (tx: Transaction) => Promise<T>) {
  return getDatabase().transaction(async tx => {
    await applyUserContext(tx, userId);
    return callback(tx);
  });
}

export async function applyUserContext(tx: { execute(query: SQL): Promise<unknown> }, userId: string) {
  await tx.execute(sql`select
    set_config('request.jwt.claim.sub', ${userId}, true),
    set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);
}
