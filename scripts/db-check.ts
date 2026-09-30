import { sql } from "drizzle-orm";
import { withUser } from "../server/db/client";
try {
  const result = await withUser("00000000-0000-4000-8000-000000000000", tx => tx.execute(sql`select current_user as role, to_regclass('public.profiles') is not null as schema_ready`));
  const state = result[0];
  console.log(JSON.stringify(state));
  process.exit(state.role === "authenticated" && state.schema_ready ? 0 : 1);
} catch (error) {
  // Never print raw driver errors: they can contain connection details or SQL.
  const failure = error as { code?: string; cause?: { code?: string } };
  const code = failure.code || failure.cause?.code;
  if (code === "28P01") {
    console.error("Database authentication failed (28P01). Use the social-web project database password, URL-encode it in DATABASE_URL, then restart the API.");
  } else {
    console.error("Database check failed. Check DATABASE_URL, the database password and migrations.");
  }
  process.exit(1);
}
