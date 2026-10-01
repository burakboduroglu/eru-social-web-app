# Medium-complexity feature implementation

Date: 2026-10-01
Status: All seven slices implemented and locally validated; remote migrations applied with owner authorization on 2026-10-02. Higher-complexity work is deferred.
Design sources: [Sidebar options](2026-10-01-sidebar-expansion-options.md), [candidate audit](../design/2026-10-01-remaining-feature-backlog.md).

## Scope and shared rules

Implement the seven medium slices below using the existing React/Vite/TanStack/Bun/Drizzle stack and bundled Pixelarticons. Limits below are project design choices, not vendor facts. Preserve current uncommitted Lists/Saved Searches/community repost changes. New schemas use additive migrations numbered after 008. The initial implementation request excluded remote changes; the owner subsequently authorized migrations 006–013 on 2026-10-02, and they were applied. Git publication is tracked separately in repository history.

Each slice must have real data, owner/member authorization, bounded inputs, cursor pages where lists can grow, and loading/empty/error/pending states. Turkish product copy, English source/docs. Keep the five mobile bottom destinations and put secondary tools in More. Never expose links to unfinished routes. No synthetic jobs/events/analytics in the real database.

Use PostgreSQL microseconds for cursor order and scope traversal to filters/query/tab. Omit unset cursor parameters. React escapes text; unsafe schemes never become navigation targets. Keep unsent form values on failures and protect navigation; success must clear the blocker synchronously. Reuse current cache invalidation and response-ordering patterns. No new paid providers or large editor packages.

### 1. Jobs with external applications

Routes: `/jobs`, `/jobs/new`, `/jobs/:id`, `/jobs/:id/edit`. Browse/search/filter by location, work mode and employment type, plus Saved and My listings filters; inspect/save/unsave. Onboarded members own draft → preview → publish → edit/close/delete. Owner-only drafts; authenticated readers see published/closed listings; closed or expired jobs disable Apply. Display publisher and external destination domain. Clicking Apply does not record a submitted application.

Dedicated `jobs` and private `job_saves` resources with owner RLS. Title/company 1–120, location 0–120, description 1–20,000, mode `onsite|remote|hybrid`, type `full-time|part-time|contract|internship`, status `draft|published|closed`. Validate application URL as HTTPS with a host; optional deadline stored as UTC. Use version checks for edits. Start without community association, salary taxonomy, media or ATS ingestion. The external website remains external and is never fetched/submitted by this app.

### 2. Text-based Articles

Routes: `/articles`, `/articles/new`, `/articles/:id`, `/articles/:id/edit`. Title 1–120, summary 0–350, plain text body 1–50,000 with paragraphs/line breaks; no HTML/Markdown dependency. Draft/preview/publish/edit/delete; owner-only durable drafts, authenticated published reader URLs, author attribution and explicit save/failure/conflict state. Dedicated resource with optimistic version checks. Published edits retain the same URL; no new notifications are promised. No covers or media.

### 3. Explore pagination

Preserve existing legacy multi-family search for account/community pickers. Add a per-tab paginated API and use it in Explore. Stable creation/id order for posts and profiles/communities, precise cursor, 20-row pages, query/tab-scoped cursor validation and reset/history on changes. Saved search reruns preserve query/tab but start traversal fresh. Existing wildcard escaping and auth visibility remain.

### 4. Durable text publishing drafts

Account/context-scoped durable text drafts and a `/drafts` library. Users explicitly save, resume and delete; publishing clears the corresponding saved draft only after success. Context records distinguish personal/community roots and replies, and recheck unavailable targets/membership before resuming/publishing. Uploaded images remain session-only in this slice and must not be advertised as durable attachments; a separate image reference lifecycle is deferred. Preserve the existing composer guard and transient attachments. No scheduling.

### 5. Functional Settings

Route `/settings`. Persist account-scoped choices for reduced motion, default Home feed and notification category. Defaults are current behavior; explicit URL filters take precedence over preferences. Reduced motion changes actual animation/scroll behavior. Save errors remain visible. Preference storage must be private; do not add unsupported toggles for account export, deletion, session revocation, muted users or light theme.

### 6. Creator analytics

Route `/analytics`, owner-only API. Show actual owned post count, received likes/replies/reposts and current follower count using recorded rows. Define whether a number is current or filtered by post date, and label it accurately. Include zero/empty cases; source deletion follows actual persisted data. Do not invent impressions, reach, revenue, engagement rates or growth histories that were not recorded. No third-party analytics ingestion.

### 7. Community events with external meeting links

Route `/events` and event creation/detail/edit pages. Current joined members can create owner-managed events scoped to one joined community; only current source-community members can read/RSVP. Title 1–120, description 0–2,000, future start time with UTC storage/local display, optional end after start, optional HTTPS external meeting link with visible domain. Browse upcoming/past, RSVP/undo, edit/cancel/delete; RSVP is idempotent and private to the user unless a count is explicitly shown. No public attendee enumeration. Handle cancelled/past events, leaving the community, removed targets and concurrency. No native audio, push reminders, scheduler or payment.

## Validation and release

Meaningful SQL/API tests for owner and member RLS, direct SQL attempts, state transitions, version conflicts, duplicate saves/RSVP, cursor ties/scope, draft context recovery and true analytics counts. Typecheck/build and affected regressions, then one full suite after final integration. Browser fixture checks at 320/375/768/1024/1440px for navigation and the principal create/edit/save/delete/restore flows, plus failures. Synthetic fixture data stays local.

Remote migration readiness is reported separately in the [remote migration review](../design/2026-10-02-remote-migration-review.md). Owner authorization on 2026-10-02 resolved the previous approval boundary: migrations 006–013 are applied, the app connection reports all twelve checked tables ready with RLS/policies/read grants, and nine read-only GET dispatch checks passed against the actual database. This verifies schema/query readiness, not a fresh signed-in browser session.

## Deferred

Medium–High and High items remain in [Deferred costly features](2026-10-01-deferred-costly-features.md), without implementation. Medium completion does not authorize native applications, AI, organizations, messaging, moderation, native audio, scheduling, Premium, realtime/push or CV storage.
