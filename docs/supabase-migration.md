# Architecture and migration notes

## Runtime

- `src/`: React UI, code-based TanStack Router routes/loaders, Tailwind/shadcn styling and browser Supabase client.
- `server/`: Bun HTTP server, authenticated JSON API and Drizzle/Postgres queries.
- `server/db/schema.ts`: typed models matching the SQL migrations.
- `shared/types.ts`: response contracts; database imports are type-only and erased from the browser bundle.
- `supabase/migrations/`: canonical SQL schema, grants, RLS, Auth triggers, invitation rules and Storage policies.
- `scripts/`: dependency-free development process orchestration, connection check and operator invitation creation.

The browser sends Supabase access tokens in Authorization headers. The API verifies each token with Supabase Auth. Each API database operation uses one Drizzle transaction: set verified JWT claims with transaction-local settings, switch to `authenticated`, then execute the query. This preserves RLS despite the pooler connection using the database owner account. Postgres prepared statements are disabled for transaction-mode pooling. Operator invitation creation intentionally uses the owner connection outside the request path.

Ordinary request queries use `withUser()` so role and claims reset when the transaction completes or fails. The narrow trusted image ingestion/cleanup path in `server/post-media.ts` uses the owner connection after Auth verification, with explicit owner/path checks, Storage row locks and a restrict FK. This registers validated metadata that authenticated callers cannot forge; do not broaden this exception. Do not return SQL/driver error objects to the browser; they may contain query parameters.

## Preserved flows

Invite sign-up, email confirmation, password sign-in, sign-out, onboarding, avatar uploads, profiles, user search, paginated personal/community feeds, replies, likes, durable reply/like/follow notifications, share links, community creation, membership and owner bio editing. Community detail pages show up to 100 members. All social data requires authentication. Avatars are public, limited to JPEG/PNG/WebP, 5 MB, and an owner UUID prefix.

## UI compatibility

Next.js server components/actions/middleware and Supabase SSR cookies are removed. TanStack Router owns navigation and loader invalidation; the Bun API owns persistence. There is no second router or data-fetching library. The UI uses X-style dark navigation, a flat feed, neutral dividers and shadcn primitives. Inline status/error messages and the small local toast viewport provide feedback without a toast package. Emoji selection and YouTube/Spotify embeds are supported without a media-player SDK. Personal GIF uploads and library selection use Supabase Storage instead of Tenor. University and campus routes were removed at the user’s request. Illustrated empty/error states follow the Hezarfen frontend pattern.

## Invitations

`202609300002_invite_only.sql` adds private invitation/redemption tables and replaces the profile creation trigger. The trigger verifies a hash, consumes one use with a conditional atomic update, creates the profile and redemption, and strips the raw code from Auth metadata. All steps participate in the Auth insert transaction. Existing users are not removed; new users always need an invitation. The first migration provisions the base schema and the second must always be applied before opening registration.

## Remaining boundaries

- The configured Drizzle pooler connection has been verified locally.
- No legacy users or content have been imported. Old user IDs, passwords and media need a separate mapping/import plan.
- Password recovery, OAuth and email/password editing are not included in this version.
- Remote GitHub repository/deployment names remain unchanged; no push or production deployment was performed.
- Auth Site URL and redirect URLs currently target local development; change them for a deployment.

## References

- https://orm.drizzle.team/docs/connect-supabase
- https://tanstack.com/router/latest/docs/routing/code-based-routing
- https://supabase.com/docs/guides/database/postgres/row-level-security

## October 1 social workflow migrations

Apply the following files in order after the existing September migrations:

1. `202610010001_thread_bookmarks.sql`
2. `202610010002_profile_follows.sql`
3. `202610010003_notifications.sql`
4. `202610010004_post_images.sql`
5. `202610010005_thread_reposts.sql`

These introduce private bookmarks, the authenticated social graph, durable activity,
validated image metadata and personal reposts. Image registration references
`storage.objects(id)` with DELETE RESTRICT; no Storage table is altered. Active
images remain immutable, and pending cleanup records cannot attach to posts.
A failed Storage delete retains its retry record. Public image URLs include draft
uploads; public Storage is not an authorization boundary for media bytes.

Following and profile Posts use process-local snapshots (15 minutes, 128 retained
snapshots) and cursor pagination. Server restarts/eviction can return 410; the UI
restarts traversal with a new snapshot. Recommended-feed ranking is unchanged.
Multi-instance deployments need shared/sticky snapshot handling. Timeline creation
currently reads all eligible activity before deduplication; large datasets need a
bounded or persisted snapshot design before scale-up.

All migrations were validated locally in PGlite. The owner applied the October 1
migrations; a subsequent read-only check confirmed matching migration history,
new tables/RLS/grants/triggers, the image bucket and Storage FK. The agent did not
apply remote migrations, upload remote media or deploy the server.
