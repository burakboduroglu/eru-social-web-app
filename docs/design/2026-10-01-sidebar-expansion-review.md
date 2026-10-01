# Sidebar expansion validation

Date: 2026-10-01
Remote follow-up: migrations 006–013 were authorized, applied and verified on 2026-10-02. See the [remote migration review](2026-10-02-remote-migration-review.md); the remote-state paragraphs below record the original October 1 checks.
Baseline: `3503585`
Scope: Private Lists, Saved Searches, More navigation, active sidebar styling and joined-community row spacing.
Plan: [Lists and saved searches](../plans/2026-10-01-lists-and-saved-searches.md).

## Implemented behavior

- More exposes Lists, Saved Searches and Bookmarks on desktop and mobile. The five mobile bottom destinations stay unchanged. Arrow keys/Home/End move through menu links; Escape closes and restores focus. Popup placement stays within the viewport while a short desktop sidebar scrolls.
- Lists provide a private library, create/edit/delete, debounced account search, idempotent add/remove, Posts/Members tabs and cursor traversal. List membership does not change follows. Timelines include personal roots and eligible reposts, with owner/list-scoped snapshots and current membership/privacy checks.
- Saved Searches preserve query and result tab. Database canonicalization deduplicates case/whitespace variants per owner/tab. Save feedback is keyed by account/query/tab and stale requests cannot update another search's state. Confirmed removal retains the row when the request fails.
- Successful list mutations clear the unsent form guard before navigation; unsuccessful requests retain values and protection.
- Active sidebar items and More use the existing gray hover color. The avatar's account menu uses the original bundled three-dot icon.
- Joined-community rows have 12px horizontal padding, consistent avatar/text alignment, a minimum 48px target and ellipsis for long names. These changes are scoped to the joined panel.

## Verification

- `bun --no-env-file test`: 152 tests passed, 0 failed, 834 assertions across 21 files. Eleven new PGlite integration tests exercise API ownership, direct SQL RLS, field constraints, membership idempotency, microsecond/timestamp-tie traversal, query deduplication, list snapshot scope and privacy rechecks, malformed routes and account-deletion cascades.
- `bun --no-env-file run build`: passed, including TypeScript checking.
- `git diff --check`: passed.
- Real application UI with isolated Vite fixtures on `127.0.0.1:4187`: create/edit/delete lists; find/add/remove a person; failed removal preserves membership and retry succeeds; list timeline 20 → 5 records; save/rerun People search; duplicate save retains one row; failed search removal preserves row and retry reaches empty state.
- Successful create/edit navigation no longer opens the unsent-change confirmation. More keyboard ArrowDown/Escape and focus restoration passed.
- 320/375/768/1024/1440px widths had no horizontal overflow. Short 450px desktop viewports at 1024/1440px kept the open menu inside the viewport. The mobile bottom bar retained five links.
- Joined panel fixture with three communities, including a long name: all rows measured 52px high with `8px 12px` padding, without overflow. Scoped desktop/mobile screenshots were inspected locally.

## Remote state and limits

The linked migration list was checked read-only. Existing migrations through `202610010005` are applied; `202610010006_private_account_lists.sql` and `202610010007_saved_searches.sql` and `202610010008_community_reposts.sql` remain pending. No remote schema or user data was changed. The automatic approval reviewer rejected `supabase db push --linked --dry-run` because this command family requires explicit user consent for the linked project. Apply the three migrations after authorization before using the new routes with the live API.

Browser checks used synthetic accounts and fixture responses, not production user credentials. PGlite validates SQL behavior but does not prove multi-connection PostgreSQL concurrency. Timeline snapshots retain the existing in-process 15-minute/128-snapshot limit. Lists have no public sharing, subscriptions or Home pins; saved searches have no alerts. This change has not been committed or pushed.


## Follow-up: menu focus and community reposts

The original More blur handler closed on a null relatedTarget. A local pointer regression reproduced a link click leaving the URL unchanged after the summary blurred. The handler now dismisses on known outside focus destinations; outside-pointer dismissal still covers pointer navigation. The same null-focus scenario now reaches Lists on desktop and mobile. All three desktop links navigate, and Tab out still closes the menu.

Community reposts were implemented under the [audience contract](../specs/2026-10-01-community-reposts.md). Four additional SQL/API tests cover membership eligibility, hidden-source undo, current actor/viewer membership, source deletion, attribution, frozen activity and personal Following/Lists exclusion. Local browser fixtures verified joined-community roots show repost, unjoined roots and replies omit it, and repost/undo updates pressed state/count. Remote migration 008 is pending alongside 006/007.
