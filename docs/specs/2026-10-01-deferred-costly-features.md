# Deferred costly features

Date: 2026-10-01
Status: Explicitly deferred by the owner for future consideration. Do not implement as part of the medium-feature work.
Sources: [Sidebar proposal](2026-10-01-sidebar-expansion-options.md), [research](../design/2026-10-01-x-sidebar-modules-research.md), [candidate audit](../design/2026-10-01-remaining-feature-backlog.md), [original spec](2026-10-01-x-inspired-social-experience.md).

Complexity is a qualitative engineering judgment; no costs or delivery estimates have been measured. These are candidate designs rather than authorized implementation commitments.

| Candidate | Complexity | Future scope and prerequisites |
| --- | --- | --- |
| AI summaries/assistant | Medium–High | Opt-in visible-thread/article summaries with sources, provider budget/rate limits, permission-aware retrieval and injection handling. No private-message retrieval or autonomous actions by default. |
| Organization/team pages | Medium–High | Organization identity, accepted affiliations, authorized editors, invitations and links to opportunities. Define role authority and member consent. |
| Native job applications | High | Intentional submission, selected profile fields/message, applicant history and publisher-only inbox. Define recipient visibility, duplication, withdrawal, job closure, edits and retention. CV files need private Storage with a distinct lifecycle; public post-image storage is unsuitable. |
| Private messages | High | Private conversations, text thread, paging, unread/delivery/reconnect/idempotency and block/report. Groups/calls/files need separate design. No unsupported encryption claims. |
| Mute/block/report/moderation | High | Define effects on every source surface and count, including direct URLs, search, replies, lists, follows, saves and notifications. Reports require an actual authorized review queue; community moderation needs explicit roles and member-removal semantics. Prioritize before future distribution expansion. |
| Native audio Spaces | High | RTC, device permissions, speakers/listeners, reconnect and moderation. Current external-link events do not implement native audio. |
| Scheduled publishing | High | Server queues, timezone behavior, edit/cancel, retries, delivery states and unavailable destinations/media. Current durable text drafts do not schedule publishing. |
| Premium/supporter memberships and payouts | High | Valuable paid entitlement first; payments, webhooks, refunds, support and payout/compliance requirements. No decorative paid badges. |
| Saved-search alerts/Radar | Higher than on-demand search | Scheduling, aggregate definitions, notification semantics and preferences. No external X ingestion or invented trends. |
| Public/shared Lists, subscriptions and Home pins | New permission design required | Reader/subscriber access, visibility changes, link/deletion behavior and pins. Current Lists remain private. |
| Browser push/realtime | Infrastructure required | Subscription storage, user permissions/preferences, delivery/reconnect and queue coordination. Existing notification reads are not push delivery. |
| Uploaded video/transcoding and durable image/media drafts | Larger media lifecycle | Registration/references, authorization, processing/storage budgets, cleanup and deleted-target recovery. Current public post-image ownership is not a general media workspace. |

Other deferred original-social candidates: quote posts, multi-post publishing, mentions/repost notifications, polls, protected accounts, OAuth/password recovery, advanced discovery/trends and monetization. Each needs a separate approved scope before implementation. In-process snapshots and explicit orphan cleanup are existing operational limits to revisit when scaling.

Revisit this document in a future session. Do not present deferred modules as available links or working features. The currently authorized scope is [Medium features](2026-10-01-medium-features.md).
