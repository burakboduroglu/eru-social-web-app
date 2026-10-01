# X-inspired social experience

Date: 2026-10-01

Status: P0–P5 implemented; owner-applied remote migrations verified; deployment pending.

Baseline: `bc6e8f6`. Implementation validation is recorded in [the review](../design/2026-10-01-implementation-review.md).

Research: [Astra feature and UX review](../design/2026-10-01-x-feature-ux-research.md).

## 1. Objective and decisions

Improve the existing conversation loop: discover a person, follow them, publish a useful post, receive activity, and return to saved conversations. Use documented X workflows as references while keeping social-web's invitation-only access, communities, pixel appearance, and existing architecture.

This is an architectural specification for incremental changes to an existing application. The initial request authorized research and a saved spec. The subsequent “go on 3 agent kullan” authorized local implementation with two Luna agents and one 6.1 Sol agent, coordinated through shared contracts.

Three approaches were considered:

| Approach | Result | Tradeoff |
| --- | --- | --- |
| Visual polish only | Refine density, navigation and feedback | Leaves follow/save/notification loops unavailable |
| Incremental social workflows — recommended | Add small end-to-end features to the existing app | Requires migrations and clear privacy/visibility contracts |
| Broad X parity | Add messaging, lists, polls, streaming and monetization as well | Substantial new product and operating responsibilities |

The recommended default is incremental social workflows with the existing pixel identity. Priorities and proposed limits below are project decisions, not measured X dimensions or copied X limits. The incremental pixel-preserving scope was used when implementation was authorized.

## 2. Verified local baseline

| Surface | Present behavior | Implementation evidence |
| --- | --- | --- |
| Stack and access | React 19, TanStack Router, Vite, Bun API, Drizzle, Supabase Auth/Postgres/Storage; invite-only registration | `package.json`, `src/router.tsx`, `server/db/client.ts`, SQL migrations |
| Home | Recommended, viewer-scoped snapshot feed; joined-community feed; latest feed also accepted by API/router | `server/feed.ts`, `server/feed-ranking.ts`, `server/api.ts`, `src/pages/social.tsx` |
| Posts | Text, replies, likes, share/copy links, author deletion, dismissal with undo; URL media and link previews | `src/ui.tsx`, `src/components/post-content.tsx`, `server/repository.ts` |
| Composer | Root posts up to 550 characters; replies up to 350; destination menu, emoji and shared/personal GIF selection | `src/ui.tsx`, `server/api.ts`, `server/validation.ts` |
| Search | Posts, people and communities with result tabs; bounded suggestions; no paginated search contract | `src/pages/social.tsx`, `server/api.ts`, `shared/types.ts` |
| Profiles | Name, handle, biography, avatar; posts/replies tabs; no social graph | `src/pages/social.tsx`, `server/db/schema.ts` |
| Notifications | Other users' replies to the viewer's posts in the preceding 24 hours; no durable event/read model | `server/api.ts`, `src/pages/social.tsx` |
| Communities | Creation, joining/leaving, member list, owner biography edit; suggestions by recency | `server/api.ts`, `server/repository.ts` |
| Storage | `post-media` is a public, GIF-only bucket with a 5 MiB limit and owner-folder write policies | `supabase/migrations/202609300003_post_media.sql` |
| Visual baseline | Flat dark feed, neutral dividers, pixel icons, restrained menus, floating pickers, top toasts | Existing compact UI spec, stylesheet files, `docs/screenshots/feed-desktop.png` |

The stored screenshot was inspected as a historical local reference. It is not a current browser audit. Current local code is the evidence for capability claims. The September 30 opportunity document remains historical; this dated review/spec is the new implementation starting point.

## 3. Experience rules

- Keep the desktop three-column shell, compact intermediate navigation, and mobile bottom navigation. Preserve the current logo, bundled icons, pixel avatars, text hierarchy, and flat feed.
- Keep five mobile primary destinations. Put saved posts and later settings in an accessible account/secondary menu; do not crowd the bottom bar with every new feature.
- Home tabs become `Senin için`, `Takip edilenler`, and `Toplulukların` when following ships. Keep selection in the URL, preserve the composer during tab switches, and reset pagination when the feed changes.
- Preserve drafts during a failed submission, feed refresh, menu interaction, and tab switch. Navigation away with an unsent draft needs an explicit discard choice. Persistent cross-session drafts are deferred.
- New post actions use the existing post menu/action layout. Like, save, repost, and external share have distinct names and states. Opening any action must not activate the card's detail link.
- Make optimistic mutations reversible on failure; prevent duplicate pending actions; update all visible instances of the same post/person. API responses remain authoritative.
- Keep floating picker geometry stable. Use a shared modal/dialog primitive for full-screen composition or media viewing, with focus management, Escape, and focus restoration. Decorative effects must respect reduced motion.
- Every new page has loading, empty, retryable error, and unavailable-item states. Empty copy states a useful next action. Turkish product copy stays separate from English implementation instructions.
- New icon controls have descriptive accessible names, keyboard operation, visible restrained focus, and a project target of at least 44px touch hit areas on mobile without enlarging icon artwork. This target is a product choice.

## 4. Release slices

| Order | Slice | Ship condition |
| --- | --- | --- |
| P0 | Shared interaction foundations | New actions cannot destroy drafts, steal card navigation, or leave stale visible state |
| P1 | Private saved posts | Save/remove and a paginated private saved timeline work end to end |
| P2 | Follow people and Following | Profiles show accurate relation state/counts and a chronological followed-person feed |
| P3 | Direct image attachments | Validated images publish and render with previews, alt text and recoverable failures |
| P4 | Durable activity notifications | Reply, like and follow events have paginated read/unread state |
| P5 | Reposts | Original attribution, undo and timeline representation are implemented together |
| Later | Safety/community evolution | Dedicated spec defines mute/block/report and moderation before broader distribution |

Each slice is independently reviewable. P1 and P2 can use separate migrations and components, but edits to the central router, API dispatcher, schema, shared types, and post component must be integrated sequentially. Astra's review offers a broader safety/draft roadmap; this spec deliberately postpones persistent drafts and requires a separate safety scope before distribution expansion.

## 5. P1 — private saved posts

**Flow:** Open a post menu → `Kaydet` → success feedback and active state → open `Kaydedilenler` → read or remove the post. The post author receives no save event or save count.

**Data and API proposal:**

- Add `thread_bookmarks(user_id, thread_id, created_at)`, unique on user/post, with cascading references and an owner/date index. RLS allows only the owner to select/insert/delete their records. Deny anonymous access and forged ownership.
- `PUT /api/threads/:id/bookmark` sets saved state; `DELETE` removes it. Both are idempotent and return `{ bookmarked: boolean }`.
- `GET /api/bookmarks?cursor=...` returns `{ posts, nextCursor }`, newest save first, with a 20-item page size. The server validates opaque cursor contents and uses `(created_at, thread_id)` as a stable tie-breaker.
- Add viewer-only `bookmarked` to hydrated `Post`; never serialize other people's saves. A saved feed uses current authorization and deliberately does not reuse `postsByIds` unchanged: that helper currently suppresses dismissed posts. Dismissal does not erase or hide an explicit save.
- Deleted originals disappear through cascade; inaccessible originals are omitted. Page traversal must still advance past omitted records. Saving an unavailable original returns a readable unavailable response.

**Acceptance:** User B cannot enumerate or alter A's saved list via API or direct database access. Concurrent/repeated saves produce one record. Removing from either surface updates the other. Saving does not alter like state, feed ranking, or notification counts. Empty state explains privacy and links to Home.

## 6. P2 — follow graph and Following

**Flow:** Visit another onboarded person's profile → `Takip et` → `Takip ediliyor`; activate again to unfollow. Counts link to separate paginated follower/following lists. Do not show a follow control on one's own profile.

**Data and API proposal:**

- Add `profile_follows(follower_id, followed_id, created_at)`, unique directed pair, self-follow check, both references cascading, and indexes for each direction. Authenticated members can read the graph; only the verified follower can create/delete an edge.
- `PUT /api/profiles/:id/follow` and `DELETE` are idempotent. Return `{ following, followerCount, followingCount }` with explicitly documented target-profile counts. Reject nonexistent, non-onboarded, and self targets.
- Profile detail gains counts and viewer relation state. `GET /api/profiles/:id/followers` and `/following` return `{ profiles, nextCursor }`, 20 at a time with stable cursor ordering.
- `GET /api/threads?feed=following&page=...` uses the existing page envelope initially. Include original, top-level personal posts by followed authors, newest first by timestamp/ID. Community posts stay in `Toplulukların`; replies and the viewer's own posts are excluded from this tab. Explain this project audience decision in empty/help copy.
- Apply current authorization and dismissal rules on every request. Keep the recommended algorithm separate; changing its follow weight is deferred until there is a deliberate ranking decision.

**Acceptance:** Duplicate and concurrent follows do not inflate counts. A cannot change B's follows. Refresh after unfollow removes that author's posts from Following. A person with no follows gets a discovery action; a followed set with no posts gets a distinct empty state. The shell and draft survive tab changes. Existing recommended snapshot isolation continues to pass.

## 7. P3 — direct image attachments

**Scope decision:** Start with up to four JPEG/PNG/WebP images, at most 5 MiB each. These are chosen project limits. Uploaded video, scheduling, polls, and mixed image/GIF attachments are deferred. Existing URL-based GIF/media posts continue to render.

**Flow:** Image control → select files → bounded previews → optional per-image alt text and removal → publish. Show per-file progress or an indeterminate upload status, cancel/remove, retry, and validation errors. Failed uploads or post creation preserve draft text and successful attachment references. Do not claim progress percentages without a transport that reports them.

**Data and API proposal:**

- Add a separate `post-images` bucket so the existing GIF archive remains GIF-only. Follow the project's current public asset rendering model, with unguessable owner-scoped object names and owner-folder write policies. This default also makes uploaded, unpublished draft images accessible to anyone with their URL; the product must not promise draft-image confidentiality. Private staging is an alternative requiring its own ingestion contract before implementation.
- Add `thread_media(id, thread_id, owner_id, object_path, mime_type, byte_size, width, height, alt_text, position)`. Bound alt text to a proposed 1,000 characters and enforce unique positions within a post.
- Extend `POST /api/threads` with image object references and alt text. The verified author must own each referenced object. Server-side object existence/type/size checks are required; client-declared metadata and arbitrary external URLs are insufficient. Validate actual file content during ingestion, and define the trusted validation path before exposing uploads.
- Allow media-only originals and replies while keeping existing text limits when text is present. Update API validation and the SQL text constraint together; require text or at least one accepted image.
- Persist post and media rows atomically. Uploads precede that transaction: removed/failed staging objects receive best-effort cleanup; define a bounded orphan cleanup operation before release. Database cascade alone does not delete Storage objects. Storage DELETE authorization must reject removal while any live `thread_media` row references the object, including a direct Storage API request. Published objects are immutable; cleanup only removes unreferenced objects under verified owner authorization.
- Render stable-ratio bounded thumbnails, useful alt text, and a keyboard-accessible viewer. Attachment media takes precedence over an automatic general link preview; retain readable text links. Failed images keep the post and a readable fallback.

**Acceptance:** A cannot reference/delete B's objects; disguised/oversized files are rejected; five images are rejected; media-only publication succeeds; partial upload and API failure preserve the draft; new media cannot widen a 320px viewport. Existing GIF library policies and link-preview protections remain intact.

## 8. P4 — durable notifications

**Flow:** A small unread badge opens `Bildirimler`; tabs show `Tümü`, `Yanıtlar`, `Beğeniler`, `Takipler`. A row links to its post/person, shows actor/action/time, and has an explicit read action. Marking only visible rows as read avoids acknowledging unseen pages. No mention tab ships before mention identity/parsing exists.

**Data and API proposal:**

- Add `notifications(id, recipient_id, actor_id, kind, thread_id?, created_at, read_at?)` with recipient/date/read indexes and a deduplication key. Publish a discriminated shared type rather than pretending a notification is a `Post`.
- Generate reply/like/follow events inside the source mutation transaction through restricted database triggers or a tightly scoped function. Do not grant users arbitrary notification INSERT access or let the client choose recipients. Recipient may read/mark their own rows only; source actor and recipient come from verified state. Restrict recipient UPDATE privileges to `read_at`, or expose only a constrained read-marker function. Row ownership alone must not allow changes to actor, kind, recipient, target or creation time.
- Ignore self activity. Unliking/unfollowing removes its current activity row; reapplying can create one fresh event, with a unique live source relation preventing duplicates. Deleting a post removes its post-linked notifications. Actor deletion removes or safely anonymizes dependent activity according to the chosen FK policy; use cascade for the first release.
- `GET /api/notifications?kind=...&cursor=...` returns `{ notifications, nextCursor, unreadCount }`, 20 at a time. Unread count covers all visible categories, not only the selected tab.
- `PATCH /api/notifications/read` accepts a bounded list of visible IDs and only changes rows belonging to the recipient. It is idempotent. Existing replies become durable events from the migration onward; historical backfill is a separate explicit operation, not assumed.
- Fetch fresh state on entry and normal invalidation. WebSocket, background polling, browser push, email delivery and operating-system permission prompts are deferred. Badge freshness must not imply real-time delivery.

**Acceptance:** New activity remains available after 24 hours. Retried source mutations do not duplicate events. A cannot read/update B's notifications. Read/unread survives reload. Deleted targets cannot crash a row or expose inaccessible content. Tab URLs, pagination, badge counts and pending/error feedback agree with server state.

## 9. P5 — reposts

**Flow:** Activate `Yeniden paylaş` on an original personal post → attributed repost appears in the reposter's profile and appropriate feed → activate `Yeniden paylaşımı geri al` to remove. External sharing remains separate. Quote posts are deferred.

- Add a unique actor/original repost relation with creation time and cascading references. `PUT /api/threads/:id/repost` and `DELETE` return `{ reposted, repostCount }` idempotently.
- Version one permits top-level personal originals; no reply or community reposts until their audience rules are specified. Reposting never widens underlying authorization.
- Community-root eligibility is extended by the [community repost contract](2026-10-01-community-reposts.md): joined-member mutations and source-scoped profile activities; Following/Lists remain personal. Migration 008 is locally validated and has not been applied remotely.
- Introduce a typed timeline entry with the original post and optional repost attribution. Following now uses a viewer-scoped activity snapshot and cursor envelope `{ entries, nextCursor, snapshot }`; update its router/loader explicitly rather than treating the old offset `FeedPage` as interchangeable. Freeze qualifying activity IDs and attribution with timestamp/ID ordering, then hydrate originals under current authorization on each page. Expired or foreign snapshot tokens return a recoverable 410, as in the existing recommended feed.
- In Following, a post reached through multiple followed actors appears once, using the newest qualifying activity and deterministic actor/ID tie-breakers at snapshot creation. Ordinary post state remains keyed by original ID. Removed/restricted activity is omitted during hydration and traversal still advances. New activity waits for refresh; a removed repost can reveal an older qualifying original/activity in the new snapshot.
- Keep recommended-feed repost ranking unchanged until an explicit decision; do not silently mix event IDs with the existing original-ID snapshot algorithm. Expose reposts first on profiles and Following. Add repost notifications only after event generation is ready.

**Acceptance:** Concurrent reposts produce one relation; undo removes only the caller's relation. Original deletion removes dependent activity. Attribution links to the reposter and original author separately. Counts, saved/liked state and share URLs refer to the original. Paging never creates duplicate entries for the same original within a stable traversal.

## 10. Discovery, safety and deferred scope

Keep existing search tabs and suggestions. A later paginated-search slice should replace silent truncation with a real `hasMore`/cursor contract, preserve query/tab in the URL, and distinguish empty query from no results. Hashtag navigation, relevance ranking, trends, recommendation interests, saved searches, and advanced filters require their own decisions.

Mute/block/report is a separate backend feature, not menu-only polish. A follow-up safety spec must define the effect on direct URLs, search, replies, communities, counts, notifications, existing follows and saves; report ownership, moderator access, and an actual review workflow are required. Invitation-only access does not itself implement these controls. Complete that scope before intentionally expanding distribution beyond the current small invite-only use.

Defer DMs, Spaces/live audio, uploaded video/transcoding, paid verification, ads, subscriptions, monetization, lists, polls, scheduling, quote posts, protected-account requests, browser push, OAuth/password recovery, and a new visual brand. These can be researched references without becoming implementation requirements.

## 11. Luna and 6.1 Sol handoff

This allocation follows task boundaries chosen for this project; it makes no benchmark or vendor capability claim.

| Owner | Work |
| --- | --- |
| `gpt-6.1-sol` | Define/freeze shared contracts; migrations/RLS, server validation/query/event work; central router/schema/type integration; review final changes and regression checks |
| `gpt-6-luna` | Build isolated UI slices after contracts are fixed: saved page, follow controls/lists, media picker/previews/viewer, notification rows/tabs, repost controls; Turkish copy, responsive/keyboard states, local fixtures |
| Primary coordinator | Choose one release slice at a time, own shared-file integration, review contract assumptions and collect validation evidence |

Implementation task cards:

| Task | Owner | Files to create/modify | Proof of completion |
| --- | --- | --- | --- |
| A. Shared mutation and dialog foundation | 6.1 Sol; Luna consumes | `src/lib/api.ts`, `src/lib/request-cache.ts`, `src/ui.tsx`, optional `src/components/action-dialog.tsx` | Failure rollback and two-visible-instance checks; draft retained across tabs/refresh |
| B. Bookmark contract and persistence | 6.1 Sol | New timestamped SQL migration, `server/db/schema.ts`, `server/api.ts`, `server/repository.ts`, `shared/types.ts`, PGlite/API tests | Two-user privacy, idempotency, deleted/dismissed originals, stable cursor checks |
| C. Bookmark UI | Luna; coordinator integrates menu/router | New `src/pages/bookmarks.tsx`, `src/components/bookmark-action.tsx`, scoped CSS; integrate `src/router.tsx`/`src/ui.tsx` | Desktop/mobile, loading/empty/error, menu keyboard and cross-surface state fixture checks |
| D. Follow contract and queries | 6.1 Sol | Migration, schema/API/repository/types, new `server/follows.ts` if extraction helps, meaningful tests | Directed ownership, no self edge, counts and Following membership/order verified |
| E. Follow UI and third tab | Luna; coordinator integrates | `src/components/follow-button.tsx`, `src/components/follow-list.tsx`, profile/Home integration in `src/pages/social.tsx` | Own/other profiles, empty lists, tab URL, pending rollback and 320px checks |
| F. Image ingestion contract | 6.1 Sol | Bucket/migration, schema/API/validation/types, optional `server/post-media.ts`, `src/lib/post-media.ts`, storage/API tests | Real object validation path, foreign-object rejection, transactional association and cleanup defined |
| G. Attachment UI | Luna; coordinator integrates composer | `src/components/media-attachments.tsx`, `src/components/media-viewer.tsx`, scoped CSS, `src/ui.tsx`, `src/components/post-content.tsx` | Partial-failure retry, alt text, media-only draft, focus and small-viewport checks |
| H. Notification event contract | 6.1 Sol | Migration/function or triggers, schema/API/types, optional `server/notifications.ts`, meaningful event/RLS tests | Deduplication, ownership, older-than-24h activity, read state and unread count |
| I. Notification UI | Luna; coordinator integrates | `src/components/notification-row.tsx`, page integration, optional `src/components/notification-badge.tsx` | All category states, unavailable actor/target, unread and read failure fixture checks |
| J. Repost timeline contract | 6.1 Sol | Migration/schema/API/types, `server/repository.ts`, Following query, ranking regression tests | Unique original traversal, undo, original deletion and stable attribution |
| K. Repost UI and final review | Luna builds; 6.1 Sol integrates | `src/components/repost-action.tsx`, post/timeline/profile integration, scoped CSS | Attribution links, distinct share action, keyboard and full regression validation |

Split these cards further if a review cannot cover them in one focused pass. Do not let both agents edit central files simultaneously. One implementation handoff contains the chosen slice, contract, exact file ownership, acceptance criteria, and verification commands; speculative later slices stay out of that prompt.

## 12. Verification and unresolved choices

For each implementation slice, run `bun run typecheck`, `bun test`, `bun run build`, and `git diff --check`. New migrations must be loaded explicitly into the relevant PGlite fixtures; existing tests name migrations individually. Add tests for security, pagination, concurrency and failure semantics rather than tests that mirror CSS or markup.

Browser verification uses local fixtures and the real application styles. Check 320, 375, 768, 1024 and 1440px, keyboard-only operation, reduced motion, long names/URLs, unavailable data, failed mutations, draft retention, and independent scroll/focus of overlays. Test representative input with the mobile keyboard open. Use compact snapshots for state checks and selector-scoped screenshots only when a visual check is needed. The linked validation record states which checks ran and which require further device/live-service verification.

No production database mutation, remote storage upload, live account action, migration deployment or push was performed. Local tests used fixtures without credentials. Applying changes to a remote Supabase project is a separately named operation.

| Decision | Recommended default | Revisit when |
| --- | --- | --- |
| Visual direction | Existing pixel identity | Owner explicitly requests visual parity with X |
| First release | P0 + P1, then P2 | Owner chooses different priorities |
| Following community content | Personal originals only | Owner wants community posts mixed into Following |
| Image delivery | Existing public asset model, separate bucket | Private/protected posts are introduced |
| Media validation | Trusted content validation before attach/publish | Implementation selects a concrete Storage ingestion mechanism |
| Notifications | No backfill or push, no mention tab | Historical import, mention parsing or real-time delivery is requested |
| Repost ranking | Profiles + Following first | Recommended-feed ranking policy is approved |
| Safety | Separate explicit scope before distribution expansion | Community/distribution scale changes |

External feature evidence and its retrieval limits belong in the linked Astra review. All normative behavior in this spec describes the social-web implementation contract; uncertain X visual behavior must not be used as a hidden implementation requirement.

## 13. Final implementation decisions

P5 supersedes P2's temporary offset envelope: Following returns `TimelinePage`
with `entries`, `nextCursor`, `snapshot` and `followingCount`. Profile Posts loads
`/profiles/:id/timeline`; profile metadata and Replies retain their existing API.
Both timeline scopes reset cursor/history/snapshot when changing tabs and recover
from 410 by starting fresh. Reposts support personal roots and the separately
specified [community roots](2026-10-01-community-reposts.md), with no repost
notifications or recommended-feed ranking change. Following and Lists remain
personal only; community repost profile activity requires current source membership.

Image ingestion accepts raw authenticated binary uploads through
`POST /api/media/images`. Trusted validation checks signatures, container structure,
dimensions and a SHA-256 comparison against stored bytes, without full pixel decode.
Successful uploads register immutable metadata using the existing owner DB
connection; authenticated clients cannot insert those records. Cleanup uses
`cleanup_pending` and an active Storage FK to retain failed attempts and prevent
attachment/deletion races. Explicit cleanup is limited to 20 old or pending own
unreferenced objects. Unregistered uploads left by a failed ingestion/cleanup are
best-effort only and are not included in the registry sweep.

Response versions are assigned when API requests start. Account-scoped optimistic
stores reconcile fresh authoritative data while rejecting older in-flight snapshots
and stale mutations after account teardown. Drafts remain in memory; image-only
drafts participate in leave/sign-out guards. Mobile refresh has its own reserved
44px slot beside the three feed tabs.
