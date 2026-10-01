import { sql } from "drizzle-orm";
import { withUser } from "../server/db/client";

// Check every new feature table, rather than reporting readiness from profiles alone.
const requiredTables = [
  "profiles", "thread_reposts", "account_lists", "account_list_members",
  "saved_searches", "jobs", "job_saves", "articles", "text_drafts",
  "account_preferences", "community_events", "event_rsvps",
];

try {
  const expected = sql.join(requiredTables.map(name => sql`(${name}::text)`), sql`, `);
  const result = await withUser("00000000-0000-4000-8000-000000000000", tx => tx.execute(sql`
    with expected(name) as (values ${expected}), checks as (
      select e.name, c.oid,
        coalesce(c.relrowsecurity, false) as protected,
        coalesce(has_table_privilege(current_user, c.oid, 'SELECT'), false) as readable,
        exists(select 1 from pg_catalog.pg_policy p where p.polrelid = c.oid) as has_policies
      from expected e
      left join pg_catalog.pg_class c
        on c.relname = e.name and c.relnamespace = 'public'::regnamespace
    )
    select current_user as role,
      bool_and(oid is not null and protected and readable and has_policies) as schema_ready,
      count(*)::int as tables_checked,
      coalesce(array_agg(name order by name) filter(where oid is null), '{}'::text[]) as missing_tables,
      coalesce(array_agg(name order by name) filter(where oid is not null and (not protected or not has_policies)), '{}'::text[]) as unprotected_tables,
      coalesce(array_agg(name order by name) filter(where oid is not null and not readable), '{}'::text[]) as unreadable_tables
    from checks
  `));
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
