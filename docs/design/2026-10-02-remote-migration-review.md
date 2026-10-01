# Remote migration verification

Date: 2026-10-02
Status: Applied and verified after explicit owner authorization. No synthetic application data was created remotely. Git publication is tracked separately in repository history.

## Application

`supabase db push --linked --yes` successfully applied all eight reviewed migrations:

- `202610010006_private_account_lists.sql`
- `202610010007_saved_searches.sql`
- `202610010008_community_reposts.sql`
- `202610010009_jobs.sql`
- `202610010010_articles.sql`
- `202610010011_text_drafts.sql`
- `202610010012_account_preferences.sql`
- `202610010013_community_events.sql`

The subsequent `supabase migration list --linked` showed matching local/remote entries through 013, with no outstanding migration.

## Live checks

The existing Bun/Drizzle app connection was used normally, without displaying or inspecting credentials. `scripts/db-check.ts` now checks profiles, reposts and all new feature tables rather than reporting readiness from profiles alone. Its read-only catalog query verifies existence, RLS, policy presence and authenticated SELECT privileges.

`bun run db:check` returned role `authenticated`, `schema_ready: true`, twelve checked tables, and empty missing/unprotected/unreadable arrays.

Nine actual API GET dispatches under the app's transaction-local authenticated role and an empty account identity succeeded against the migrated database: Lists, Saved Searches, Jobs, Articles, Drafts, Preferences, Analytics, Events and a nonmatching Explore search. Only route readiness was printed; no records or credentials were exposed. No remote fixtures or application writes were needed. These checks verify schema/query execution; they do not claim a newly signed-in browser user flow was exercised.

The local development server was restarted because no listener was present. Vite responds with HTTP 200 on `127.0.0.1:5173`; the Bun API runs on `127.0.0.1:3001`. Unauthenticated `/api/lists` returns HTTP 401, preserving its authentication boundary. TypeScript checking and `git diff --check` passed after the readiness script update.

Earlier fixture/browser and 161-test validation is recorded in the [medium feature review](2026-10-01-medium-features-review.md). Expensive features remain in the [deferred specification](../specs/2026-10-01-deferred-costly-features.md).
