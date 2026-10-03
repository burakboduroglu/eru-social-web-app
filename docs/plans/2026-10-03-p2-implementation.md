# P2 implementation plan

Design: [Subject discussions and structured job sharing](../specs/2026-10-03-p2-discussions-and-job-sharing.md).
Status: Implemented locally. Migrations 202610030001 and 202610030002 are not applied to any remote database.

## 1. Create and open a canonical subject

- **Files:** `supabase/migrations/202610030001_discussions.sql`, `server/db/schema.ts`, `shared/discussion-types.ts`, `server/discussions.ts`, `server/api.ts`, `src/pages/discussions.tsx`, `src/router.tsx`.
- **Do:** Define community-scoped normalized title identity and RLS. Implement create-or-reuse without silently posting an entry. Expose subject metadata and a canonical detail URL. Keep the display title immutable.
- **Verify:** Read back unique indexes, normalization trigger, explicit grants and route matching; coordinator checks the fixture create/reuse and deep-link flows.
- **Done when:** Two same-community normalized titles resolve to one subject ID, and its detail opens independently of directory state.

## 2. Publish and read entries

- **Files:** Discussion migration/service/types/page and `src/components/discussions.css`.
- **Do:** Add separate plain-text entries, oldest-first scoped pagination and database subject locks. Require onboarded current members and open status. Preserve text on errors and block duplicate submissions.
- **Verify:** Read back entry RLS and guarded insertion; coordinator inspects empty/populated/locked/non-member fixtures and entry traversal with previous-page history.
- **Done when:** Chronological entry pages and member publishing are usable without changing existing social posts or drafts.

## 3. Discover, follow and save subjects

- **Files:** `server/discussions.ts`, `src/pages/discussions.tsx`, `src/components/discussions.css`, `src/components/navigation-config.ts`, `src/components/feature-sidebar.tsx`.
- **Do:** Add title/community and All/Following/Saved URL views. Implement private idempotent Follow/Save. Keep directory chrome during loading and reset cursors for filter changes. Register secondary navigation and page guidance.
- **Verify:** Coordinator checks independent relationship states, filtered empty states, Back/Forward state and 320px control reflow; read back own-reference cleanup policies.
- **Done when:** Follow/Save drive distinct private views and do not promise alerts or expose aggregate relationship counts.

## 4. Moderate entries and subject status

- **Files:** Discussion migration/service/page.
- **Do:** Allow authors or community owners to delete entries. Allow community owners to lock/unlock using expected versions. Preserve canonical identity and entries authored by others when the subject creator account is removed.
- **Verify:** Read back owner/author authorization and row-lock/version conditions; coordinator checks confirmation, pending/error and stale-version fixture behavior.
- **Done when:** Moderation follows visible authority, stale updates are rejected, and locking prevents new entries while preserving reading.

## 5. Attach a job to a reviewable social draft

- **Files:** New job-reference migration, `server/db/schema.ts`, `server/api.ts`, `server/repository.ts`, `server/text-drafts.ts`, `shared/types.ts`, composer/draft helpers, `src/pages/jobs.tsx`, `src/ui.tsx`, scoped reference CSS.
- **Do:** Add structured resource kind/nullable job ID. Validate current published visibility on attachment. Preserve the reference through save/resume and existing unsent-draft guards. Hydrate current job availability or an unavailable marker; feed cards use the canonical detail link.
- **Verify:** Coordinator reads schema/API visibility and deletion behavior and inspects composer review, durable draft and closed/expired/deleted reference fixtures.
- **Done when:** Sharing opens a draft, publishing stays explicit, and existing shares never advertise stale direct Apply actions.

## 6. Integrate and record limits

- **Files:** Specs/plans, router/type/API integration, implementation review document.
- **Do:** Reconcile exports/paths and stage ownership. Complete coordinator typecheck/build/diff checks and representative browser inspection. Record migrations as local/unapplied until separately deployed.
- **Verify:** `bun --no-env-file run typecheck`, `bun --no-env-file run build`, and `git diff --check` where repository scripts exist; coordinator records concrete results and scoped screenshots.
- **Done when:** Current routes/types compile, representative UI states are usable, and the report distinguishes local source changes from external database deployment/publication.

No new dependencies, external database application, schema backfill, test creation or remote publication are part of these agent tasks. Ranking, notifications, rich text, cross-community subject merges and administrator/reporting workflows remain outside this frozen slice.
