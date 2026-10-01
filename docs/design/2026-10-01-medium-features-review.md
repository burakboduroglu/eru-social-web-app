# Medium features validation

Date: 2026-10-01
Status: All seven medium slices implemented and locally verified. Remote migrations were subsequently authorized, applied and checked on 2026-10-02; see the [remote migration review](2026-10-02-remote-migration-review.md).
Scope: [Medium features](../specs/2026-10-01-medium-features.md), [execution plan](../plans/2026-10-01-medium-features.md), [deferred candidates](../specs/2026-10-01-deferred-costly-features.md).

## Share dropdown

PostCard share now opens a bounded, portaled dropdown next to the post, rather than a separate page. Copy link, supported native sharing and the existing WhatsApp destination are available. The old share route redirects to the thread for existing links. Menu items support arrow/Home/End keys, outside dismissal, Escape/focus restoration and 44px targets. Clipboard failure keeps the menu open with a selectable URL; success closes with a toast.

Isolated browser checks on 127.0.0.1:4187 passed desktop copy without route navigation, 320px bounds/no horizontal overflow, Escape/focus restoration, injected clipboard failure/manual URL recovery and successful retry. This used synthetic accounts, not user credentials.

## Medium implementation checks

Coordinator fixture 127.0.0.1:4188 runs the real API dispatch under authenticated transaction context against PGlite with actual app migrations. Supabase-owned Auth/Storage schemas and three accounts are local fixtures. No real DB/user data or credentials are used. This separates UI integration checks from the remote schema prerequisite.

- Jobs: browser create → private draft → publish, private save toggle, correct external HTTPS application destination, literal script text without executable nodes, and 320px geometry passed.
- Articles: browser form → literal-text preview → private draft → publish at the same URL passed. Script-like text produced no executable nodes. A different account could read the published article but its direct edit URL showed the owner-only guard, with no editable fields.
- Explore: actual API/browser traversal of 25 matching posts returned 20 → 5 → 20 through Next/Previous. Blank-query discovery still showed recommended accounts and community empty-state content.
- Durable drafts: explicit save survived browser/session restart; library resume restored text; successful publication cleared its associated saved draft. Injected save/publication 503 failures kept the text, exposed an error and allowed retry. Failed publication retained one saved draft; successful retry left zero. Library deletion returned the composer to the create-draft state. Deleted references are removed for the current account without clearing unrelated references.
- Settings: UI changes persisted reduced motion, Following as the default feed and Replies as the notification category. Reloading Home/Activity used those defaults; an explicit `feed=all` URL selected For You instead. The root reduced-motion dataset changed to `true`.
- Analytics: browser cards reported two persisted owned originals and zero recorded interactions/followers in the fixture at that point. Narrow card geometry and the rendered mobile viewport passed. SQL/API tests verify received interactions, undo, deletion, owner scope and post-date filters.
- Events: browser future-event creation, local time display, validated external meeting domain, RSVP and undo passed. The synthetic nonmember token received 404 for the event while published Articles remained readable. SQL/API tests additionally exercise private RSVP, membership changes, duplicate insertion, terminal cancellation, ownership, bounds and version conflicts.
- Navigation: seven primary desktop links; Jobs/Articles are promoted. More has seven tools, and compact More has all nine additional destinations. Checks at 320/375/768/1024/1440px found no horizontal overflow. At 1440×600 only the navigation scrolls; account controls stay inside the viewport. At 1024×600 the popup is above main content, has 44px rows and navigates even when pointer interaction causes a null-relatedTarget blur. The five mobile bottom links remain accessible; the last compact More link successfully opened Analytics.

## Final verification

- Full suite: `bun --no-env-file run test` — 161 passed, zero failures, 948 assertions across 22 files.
- After final draft-reference cleanup, the affected composer/medium tests and production build were repeated successfully.
- `bun --no-env-file run build` includes TypeScript verification and passed. `git diff --check` passed.
- A late integration test caught resource cursors encoding whole resource rows. The shared encoder now serializes only ID and precise timestamp; tied-row traversal, viewer/filter scoping and maximum-length multibyte Job filters pass.
- The short sidebar originally let main content cover its fixed More popup. Sidebar stacking and independent navigation scrolling now keep the popup clickable and account controls pinned.

## Release boundary

The read-only linked check on 2026-10-01 found remote migrations through 005 and pending 006–013. A db-push attempt was rejected at that time for missing explicit remote-mutation authorization. The owner subsequently authorized the operation on 2026-10-02; all eight migrations are now applied, and the live app connection/read-only dispatch checks pass. Keep the earlier synthetic browser validation separate from this live schema verification. Git publication is tracked separately in repository history.
