# Remaining feature candidates

Date: 2026-10-01
Status: Historical audit. Medium slices were subsequently authorized; Medium–High/High work is explicitly deferred.
Sources: [Sidebar options](../specs/2026-10-01-sidebar-expansion-options.md), [sidebar research](2026-10-01-x-sidebar-modules-research.md), [original social specification](../specs/2026-10-01-x-inspired-social-experience.md).

Execution scope: [Medium features](../specs/2026-10-01-medium-features.md). Future work remains in [Deferred costly features](../specs/2026-10-01-deferred-costly-features.md). The table below preserves the research classification and does not supersede either decision.

## Current boundary

Original P0–P5 are implemented. Private Lists, Saved Searches and More exist locally, as do the follow-up menu focus correction and community repost support. Linked migration inspection on October 1 found 006/007/008 pending. Feature implementation and remote schema readiness are separate states. Existing authenticated live browser and real Storage upload verification still require the appropriate live session.

The sidebar expansion document is a research proposal. Its historical statement that Lists are absent is superseded by the [implemented plan](../plans/2026-10-01-lists-and-saved-searches.md). Public/shared Lists, subscriptions, Home pins and saved-search alerts were excluded from the initial slice.

## Suggested next work

Complexity is qualitative engineering judgment, not a delivery estimate.

| Order | Candidate | Complexity | Minimum useful slice and dependencies |
| --- | --- | --- | --- |
| 1 | Jobs with external applications | Medium | Search/filter/detail/save plus member-owned draft, preview, publish/edit/close. New jobs/job_saves, owner RLS, URL validation and destination domain. A click does not imply a submitted application. Useful listing supply is required. |
| 2 | Articles | Medium | Title, summary, constrained Markdown/text, preview, durable private drafts, publish/edit/delete and reader URL. Sanitization and version-conflict handling; begin without covers to avoid another media lifecycle. |
| 3 | Explore pagination | Medium | Per-tab cursor contract, stable ordering, next page and reset on query/tab changes. Current search caps each family at 20 and has no pagination contract. Directly benefits Saved Searches. |
| 4 | Mute/block/report and community moderation | High | Define effects across direct URLs, feeds, search, replies, saves, notifications and counts. Reports need an actual authorized review queue; community member removal/rules require roles. Prioritize before widening distribution. |
| 5 | Durable publishing drafts/media workspace | Medium | Account/context-scoped storage, publish/account lifecycle, recovery for missing targets/media, library view. Scheduling is a separate high-complexity queue/timezone/edit/cancel/delivery subsystem. |
| 6 | Private 1:1 Messages | High | Conversation list, account picker, text thread, cursor pages, unread counts, reconnect/idempotency and block/report. Private authorization and delivery infrastructure; groups/calls/attachments excluded initially. |
| 7 | Native job applications | High | Intentional submission with selected profile fields/message, applicant history and publisher-only inbox. Duplicate, withdrawal, closure, retention and recipient rules. CV uploads require private Storage and separate authorization. |

Jobs MVP uses an external employer link; it has no native applications history. Native applications are an independent subsystem. Existing public post-image Storage is unsuitable for private CV files. Relevant boundaries: sidebar options lines 75–140 for Jobs/applications, 159–173 for Articles; original social spec lines 144–148 for deferred search, safety and publishing.

## Additional research candidates

| Candidate | Complexity | Boundary |
| --- | --- | --- |
| Community events/Spaces | Medium for events/RSVP/external meeting link; High for native audio | Native audio adds RTC, speaker roles, device permissions and moderation. |
| AI assistant | Medium–High | Opt-in summaries of selected visible threads/articles with source links. Provider, budgets and permission-aware retrieval; no private-message retrieval or autonomous actions initially. |
| Creator analytics | Medium | Owner-only metrics for recorded interactions with precise definitions; never invent impressions. Payouts are a separate high-complexity feature. |
| Real settings | Medium | Independent appearance/reduced-motion, notifications and supported session preferences. Block-management only after its backend; no decorative switches. |
| Organization/team pages | Medium–High | Accepted affiliations, authorized editors, distinct organization identity and invitations. |
| Shared Lists/subscriptions/Home pins | Further permission design required | Expand owner-only visibility deliberately; frozen private Lists do not authorize sharing. |
| Saved-search alerts/Radar | Higher than current on-demand searches | Scheduling and notification semantics; no external X ingestion or unsupported trend claims. |
| Supporter/Premium membership | High | Meaningful paid benefit first, then payments/entitlements/webhooks/refunds/support. Low early priority. |

Original social backlog also contains mentions/repost notifications, quote posts, multi-post publishing, discovery/advanced filters, browser push/realtime, uploaded video/transcoding, polls, scheduling, protected-account requests, OAuth/password recovery and monetization. They were deferred rather than missing from the completed P0–P5 scope. Existing in-process snapshots and explicit orphan-media cleanup are operational limits to revisit for scale.

Recommended continuation: Jobs → Articles, if member-posted jobs have content supply. Explore pagination is the closest practical extension of current Saved Searches. Safety/moderation becomes urgent before new distribution or private messaging surfaces.
