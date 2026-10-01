# Private Lists and Saved Searches

Date: 2026-10-01
Baseline: `3503585`
Status: Implemented and locally validated; linked migrations 006/007 await explicit authorization.
Validation: [Sidebar expansion review](../design/2026-10-01-sidebar-expansion-review.md).
Design: [Sidebar expansion options](../specs/2026-10-01-sidebar-expansion-options.md).

## Frozen scope and contracts

- Private account lists only; no shared lists, subscriptions, Home pins or public discovery.
- Lists curate accounts independently of global following. Timelines include personal roots and eligible personal reposts; community posts and replies are excluded.
- Saved searches retain query and Explore tab (`posts`, `people`, `communities`), rerun on demand, and are private. No polling, alerts, X ingestion or AI trend claims.
- Five mobile bottom destinations remain; desktop and mobile secondary access uses More.
- New migrations: `202610010006_private_account_lists.sql`, `202610010007_saved_searches.sql`. Remote application is a separately authorized operation; local implementation/tests must not read credentials.

Proposed limits are project choices: list name 1–80 characters, description 0–350; normalized saved query 2–80 characters. Paginated library/member responses use 20 rows plus a next cursor. Preserve PostgreSQL microseconds with existing cursor helpers.

```ts
type AccountList = { id: string; ownerId: string; name: string; description: string; createdAt: string; updatedAt: string; memberCount: number };
type AccountListsPage = { lists: AccountList[]; nextCursor: string | null };
type SavedSearch = { id: string; ownerId: string; query: string; tab: "posts" | "people" | "communities"; createdAt: string };
type SavedSearchesPage = { searches: SavedSearch[]; nextCursor: string | null };
```

| Endpoint | Contract |
| --- | --- |
| `GET /lists?cursor` | `AccountListsPage` |
| `POST /lists` | `{ name, description }` → `AccountList` |
| `GET /lists/:id` | `AccountList`; unavailable or foreign list is 404 |
| `PATCH /lists/:id` | `{ name, description }` → `AccountList` |
| `DELETE /lists/:id` | `{ success: true }`; owned resource only |
| `GET /lists/:id/members?cursor` | Existing `ProfileListPage` |
| `PUT /lists/:id/members/:profileId` | `{}` → `{ member: true, memberCount }`; onboarded account required |
| `DELETE /lists/:id/members/:profileId` | `{ member: false, memberCount }`; idempotent removal |
| `GET /lists/:id/timeline?cursor&snapshot` | Existing `TimelinePage`; list/viewer scope, current privacy/membership recheck, 410 recovery |
| `GET /saved-searches?cursor` | `SavedSearchesPage` |
| `POST /saved-searches` | `{ query, tab }` → `SavedSearch`; case/whitespace-normalized duplicate returns existing row |
| `DELETE /saved-searches/:id` | `{ success: true }`; unavailable or foreign resource is 404 |

List timeline loader combines metadata with timeline on Posts and metadata with paginated members on Members. Omit unset cursor/snapshot parameters. Reset traversal on tab or membership changes; never reuse a profile/Following snapshot for a list. Deleting an account removes dependent list membership and searches.

## 1. Backend vertical slice

- **Files:** two migrations; `server/db/schema.ts`, `shared/types.ts`, `server/lists.ts`, `server/saved-searches.ts`, `server/timeline.ts`, `server/api.ts`, relevant database fixtures and new backend tests.
- **Do:** Add owner-scoped RLS and bounded validation. Implement exact routes with method/segment checks. Extend existing snapshot traversal for list scope without changing Following/profile behavior. Canonicalize duplicate saved queries in the database as well as the API.
- **Verify:** PGlite tests for owner/foreign access, direct RLS, membership idempotency/removal/cascade, microsecond pagination, invalid routes, list snapshot isolation/privacy/membership changes and saved-query duplicate races; typecheck.
- **Done when:** Typed API contracts are exercised under the authenticated role and unrelated timeline behavior still passes.

## 2. Lists UI vertical slice

- **Files:** `src/pages/lists.tsx`, scoped list components/CSS. Coordinator owns central router, menu and icon edits.
- **Do:** Library, create/edit form, detail Posts/Members tabs, debounced people picker, add/remove member and delete-list action. Explicit private copy, empty/error/loading/pending states, unsent form guard and cursor controls. Show excluded community-content rule in appropriate empty/help copy.
- **Verify:** Browser fixture: create, edit, find/add/remove people, Posts/Members traversal, delete, retry/rollback and 320px geometry; typecheck.
- **Done when:** Users can manage their list and read its account-scoped timeline without changing global follows.

## 3. Saved Searches UI vertical slice

- **Files:** `src/pages/saved-searches.tsx`, `src/components/save-search-action.tsx`, scoped CSS. Coordinator integrates Explore.
- **Do:** Cursor-paginated saved library; rerun link with exact Explore tab/query; confirmed removal with recoverable errors. Add a save action for meaningful active Explore queries; show explicit pending/success/error and handle account/query changes.
- **Verify:** Browser fixture: save and duplicate save, rerun with original tab, remove/error retry, new/empty query, long query and mobile layout; typecheck.
- **Done when:** Saved searches survive server reload and never leak across accounts.

## 4. Integration and delivery

- **Files:** `src/router.tsx`, `src/pages/social.tsx`, More menu and scoped navigation CSS, bundled icon map, README and validation notes.
- **Do:** Register typed routes/loaders, integrate Explore action, add keyboard-accessible More on desktop/mobile without adding bottom targets. Keep account actions separately labeled. Validate schema prerequisites and prepare migration dry-run once local work is reviewable.
- **Verify:** `bun --no-env-file run typecheck`, `bun --no-env-file test`, `bun --no-env-file run build`, `git diff --check`; isolated real-app browser fixtures at 320/375/768/1024/1440px. No remote mutations or commit/push without explicit authorization.
- **Done when:** Both features are integrated and the final report distinguishes local validation from migration/deployment status.
