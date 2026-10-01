# Social workflow implementation review

Date: 2026-10-01

Scope: P0–P5 from the [X-inspired specification](../specs/2026-10-01-x-inspired-social-experience.md), implemented locally with two Luna agents, one 6.1 Sol agent and coordinator integration. Astra completed the preceding source-based research. The existing pixel identity and recommended-feed ranking remain the baseline.

## Implemented behavior

- Private bookmarks with cursor pagination and an account-menu entry.
- Follow/unfollow, profile counts, follower/following lists and a separate Following tab.
- In-memory account/context drafts, including image-only leave/sign-out guards; successful publish clears its draft, failed publish preserves it.
- Four JPEG/PNG/WebP attachments, authenticated binary ingestion, trusted immutable metadata, alt text, upload retry/removal, media-only posts/replies and a keyboard viewer. Broken image resources retain readable fallback content.
- Durable reply/like/follow activity with category filters, cursor pagination, explicit read markers and an unread badge. No historical backfill or push.
- Personal-original repost/undo, count/state, original author attribution and reposter attribution in Following/profile timelines.
- Request-start response ordering for account-scoped optimistic bookmark/follow/repost state. Older requests and stale account completions cannot overwrite newer mutations.
- Recoverable 410 timelines restart with a fresh snapshot and empty cursor/history.

## Validation evidence

`bun --no-env-file test`: **137 passed, 0 failed, 681 assertions across 20 files**. PGlite fixtures apply the actual migrations and cover ownership/RLS, malformed endpoint handling, precise cursor ordering, deduplication, deletion/dismissal, snapshot viewer/scope isolation, durable events, image checks, protected Storage operations and failed-cleanup retry. State tests cover rollback, duplicate pending actions, response ordering and account teardown. The local HTTP fixture test ran with loopback permissions; no remote service was exercised.

`bun --no-env-file run build`: passed, including `tsc --noEmit`. `git diff --check` and untracked text whitespace checks passed. No dependencies were added. After the final readability pass on `server/timeline.ts` and `server/reposts.ts`, the focused follow/repost suite passed 13 tests with 93 assertions; typecheck passed and a TypeScript AST comparison confirmed exact SQL template preservation.

Browser checks used the actual Vite application with an isolated local fixture server (`envDir: false`) and synthetic authentication/API responses. Confirmed:

- Text draft retention across tabs; cancelling navigation preserves text and image-only drafts.
- Saved-post next/previous pagination; failed removal keeps the menu open, restores saved state and presents retryable feedback.
- Notification read controls clear the unread badge.
- Image-only publish with alt text clears staging and renders the attachment. Viewer opens, focuses its close control, closes on Escape and restores thumbnail focus.
- Follow action populates Following; cursor traversal shows 20 then 3 fixture entries. Repost appears on the viewer's profile with attribution; undo removes it.
- Expired snapshot shows the 410 state; retry removes the old snapshot/cursor and loads the first page.
- No horizontal overflow at 320, 375, 768, 1024 and 1440px. A scoped 320px visual check caught overlapping refresh/tab controls; reserving a 44px refresh slot resolved it. The image thumbnail stacking layer was corrected after a real click revealed the card link intercepted viewer activation.
- Browser reported no uncaught errors after the final checks.

## Deployment and operational limits

The owner subsequently applied all five October 1 migrations. Read-only verification confirmed matching remote/local history, all six new tables with RLS and authenticated SELECT grants, all six enabled triggers, the public 5 MiB JPEG/PNG/WebP bucket, and the restrict Storage FK. The implementation and live verification performed no live account mutation, remote upload or deployment. Source-control publication was subsequently authorized by the owner. Authenticated browser and real Storage upload behavior still need live-service verification.

Image draft URLs are public. Validation inspects signatures/container structure/dimensions and verifies the stored-byte checksum; it does not fully decode compressed pixels. Active metadata holds a restrict FK to `storage.objects(id)`. Pending cleanup clears that FK and disallows attachment, retaining failed Storage deletes for retry. Explicit own-object cleanup handles up to 20 old or pending registered uploads; unregistered ingestion leftovers remain best-effort only. There is no automatic cleanup scheduler.

Timeline snapshots are process-local (15 minutes, 128 retained snapshots). Multi-instance operation needs shared/sticky snapshot handling. Snapshot creation currently reads all eligible activity; large datasets need bounded/persisted traversal. Browser checks emulate viewport widths; physical mobile keyboards, screen readers, reduced-motion device behavior and exhaustive network-interruption scenarios were not validated.

## Same-day follow-up fixes

Profile Posts initially sent `cursor=&snapshot=` to its timeline endpoint, which
correctly rejected the empty cursor with 400. The loader now omits unset query
parameters and resets to the first page when no snapshot is available. A strict
local fixture reproduced the failure contract; profile entry and next/previous
traversal (20 → 5 → 20 entries) now pass without 400.

Reply attachments were auto-placed in the 40px avatar grid column. They now use
the textarea column, with an empty-state image action in the reply toolbar and
attachment controls revealed after selection. Single-image grids span the full
available width. Browser checks cover empty and selected-image layouts at 320,
375, 768 and 1024px, readable alt input and reachable reply controls. Build,
typecheck and diff whitespace checks passed after these fixes. The owner's 5173
page required login in the isolated browser; UI validation used the same React
components/styles on the local fixture server without reading credentials.
