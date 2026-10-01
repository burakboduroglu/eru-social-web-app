# X sidebar module research

Research date and source retrieval date: **2026-10-01**.

Status: product research and proposed scope only; no application implementation, account changes, authenticated browser audit, or live menu inspection.

## Recommendation

Shortlist **Opportunities / Jobs**, **Lists**, and **Articles**. Opportunities adds a distinct reason to visit an invite-only network; Lists offers the smallest implementation that reuses existing feeds; Articles supports durable member knowledge with moderate editor work. Ship only the selected module first. Their relative value depends on whether members primarily want opportunities, better reading, or publishing.

These are recommendations for social-web, not claims that X exposes identical functionality to every user. X capabilities below are tied to official documentation. All proposed routes, schemas, costs, priorities, and product tradeoffs are our design judgments.

## Method and limits

- Searched public official X documentation with Brave `bx`; read the Premium Business page in full with Firecrawl because snippets did not resolve Hiring details.
- Source retrieval establishes what official pages document, not that every page is synchronized with current production UI. No visual or authenticated desktop menu audit was performed.
- Desktop navigation placement is documented for Lists, Articles, Grok, Premium, Media Studio, Monetization, and Settings. Exact current ordering, labels, account visibility, experiments, and regional availability were not observed. Sources are linked in each comparison row.
- Candidate job search, saved jobs, native applications, resume storage, and application status were **not verified** in the retrieved official documentation. Employer Hiring capability is verified separately.
- Existing app context supplied for this research: React 19, TanStack Router, Bun API, Drizzle, Supabase; invite-only membership; dark pixel UI; Home, Explore, Notifications, Communities, Profile in primary navigation; private bookmarks in the account menu. Following, images, durable notifications, and personal reposts already exist. These were not independently audited in this research.
- A broad Jobs search returned unrelated third-party recruitment guides. Those are not used as evidence.

## Twelve candidate modules

The X column contains sourced observations. The remaining columns propose social-web behavior. Cost is qualitative implementation and operational burden, not a delivery estimate.

| Module | Documented X capability and placement confidence | Proposed social-web journey and information architecture | Smallest useful MVP / excluded scope | Dependencies, burden, and small-network fit |
| --- | --- | --- | --- | --- |
| **1. Opportunities / Jobs** | Premium Business documents a Hiring tab inside its portal, ATS or manual job creation, featured jobs on profiles, copied job links, and promotion. Premium Organizations documents discoverable career-site positions. General user Jobs menu placement and candidate flow were not verified. [S1][S2] | Sidebar Opportunities → searchable role cards → role detail → external application destination. Secondary tabs: Saved and My listings. Publishing: draft → preview → publish → close. | Member-posted roles, filters, clear employer/application destination, private saves, closed state. Exclude native CV upload, candidate inbox, ATS import, paid placement, automatic scraping, and assertions that a click means an application was submitted. | Medium: listing ownership, moderation, expiry/closure, search, external URL validation. Low recurring infrastructure beyond the existing stack. Strong if members exchange real opportunities; otherwise an empty board. |
| **2. Lists** | Curated accounts produce list timelines; public/private creation, following lists, and pinning/reordering are documented. Desktop instructions explicitly say Lists in the navigation bar. X-public lists are visible more broadly than an invite-only app should permit. [S3] | Lists → Mine / Following / Discover → list detail with Posts / Members → edit membership and visibility. Optional pin action adds a Home feed tab. | Create/rename/delete, account picker, list feed, private or community-visible scope. Exclude collaborative editing, recommendations, list analytics, and automated imports. | Low–medium: lists, memberships, visibility predicates, existing feed query reuse. No external service. Best implementation-to-value ratio if the network has enough active authors. |
| **3. Articles** | Rich long-form publishing, editing, deleting, an Articles tab in x.com side navigation, and a profile Articles tab are documented. Dedicated page says Premium, Premium+, Premium Business, and Premium Organizations globally. [S4] | Articles → Latest / My drafts → editor → preview → publish → article detail; author profile gains Articles tab. Share a compact article card into existing feed. | Title, summary, optional cover, constrained Markdown or structured rich text, autosaved drafts, preview, publish/edit/delete. Exclude arbitrary HTML, paid articles, coauthors, revision history, and complex embeds. | Medium: editor, sanitization, drafts, image reuse, reader layout. Low recurring infrastructure. Strong for project writeups and community knowledge; risk is a mostly empty section without authors. |
| **4. Messages / Chat** | Current Chat docs describe encrypted messages, media and groups, registration requirements, message requests, and encryption exceptions. The page documents compose/search/send; current desktop sidebar label or location was not verified. [S5] | Messages → conversation list / requests → member picker → thread. Profile Message action enters same route. | Private 1:1 text, unread count, pagination, block/report. Exclude groups, calls, attachments, disappearing messages, and any end-to-end encryption claim unless actually implemented. | High: realtime delivery, reconnect/idempotency, authorization, abuse handling, notification coordination. Valuable in a small network, but a substantially larger subsystem than Lists or Articles. |
| **5. Spaces / live rooms** | X documents live audio, hosting/scheduling, speaking requests, recordings, and Community Spaces. Help says web supports listening; documented creation flows are mobile. A universal desktop Spaces sidebar destination is unverified. [S6][S7] | Rooms → Live / Upcoming / Past → room detail → join; host controls and participant roles. | First consider scheduled community events with RSVP and an external meeting link. Native-audio MVP would require host/listener/speaker roles and mute/remove. Exclude recording, transcription, discovery ranking, and monetization initially. | Native audio is high burden: managed RTC or WebRTC infrastructure, permissions, moderation, bandwidth. Events with external meeting links are medium and can be valuable with a small active group. |
| **6. AI assistant / Grok analogue** | Grok documentation explicitly places its icon in app/website navigation and describes conversational assistance. Premium documentation describes tier-specific increased limits. [S8][S9] | Assistant → conversation history → question → answer with links to authorized local posts/articles. | Opt-in summarization of a selected thread/article with citations. Exclude autonomous actions, general personal agents, image generation, and private-message access. | Medium–high: model provider, usage budgets, streaming, permission-aware retrieval, prompt-injection handling. Ongoing usage cost. Weak without a clear task beyond an external chatbot. |
| **7. Premium / membership** | Basic, Premium, and Premium+ exist; official instructions put Premium in x.com side navigation and describe subscribe/manage/preferences. Feature availability varies by platform. [S9][S10] | More → Support / Membership → tangible benefits → checkout → billing. | Only after a supported paid benefit exists; simple supporter membership if desired. Exclude paid reach, verification semantics copied from X, advertising products, and multiple complex tiers. | High relative to immediate member value: payments, entitlements, webhooks, refunds, support. Poor first expansion for a small invite-only product. |
| **8. Creator dashboard / analytics / monetization** | Creator Dashboard documents estimated earnings and subscriber information; desktop path is More → Professional Tools → Monetization. Subscription and reward participation are eligibility-dependent. These docs do not establish a universal current “Creator Studio” label. [S11][S12][S9] | More → Creator dashboard → own content → activity by period → content detail. Monetization is a separate future area. | Owner-only counts for existing recorded interactions and authored content, with clear metric definitions. Exclude inferred impressions, revenue, subscriber payments, and public leaderboards. | Medium for truthful local analytics; high for payouts. Needs event definitions and aggregation. Useful later, but limited by small sample sizes. |
| **9. Professional tools / organization profiles** | Professional Accounts are described as a free account type; Professional Home includes analytics, profile spotlights, promotion, monetization, and resources. The page explicitly notes rollout-dependent availability. Premium Business is a separate paid product. [S13][S1] | More → organization/team page → members / links / opportunities → authorized editors. | A team page with description, links, member affiliations requiring acceptance, and linked opportunities. Exclude ad manager, storefront, paid verification, and external CRM integrations. | Medium–high: organization ownership, role permissions, invitation acceptance, separate page identity. Good only when multiple real teams already use the app. |
| **10. Radar / saved searches** | Premium Business documents keyword monitoring and conversation/trend tracking in Radar (Beta), a limited version for Premium+, and greater query availability for Full Access. Organizations documents full functionality. Current universal sidebar placement was not verified. [S1][S2] | More → Monitors → saved keyword query → matching posts → optional notification preference. | Saved local searches with on-demand results. Exclude AI trend claims, external X ingestion, constant polling, and automated alerts initially. | Low–medium for saved queries; higher for scheduled alerts and aggregates. Cheap reuse of Explore, but low volume can make trends uninformative. |
| **11. Settings and account controls** | X documents More → Settings and privacy on desktop, including account archive access; separate docs cover personalization/data controls. [S14][S15] | Account menu / More → Account / Appearance / Notifications / Privacy / Sessions. | Real preferences backed by the existing product: reduced motion, notification choices, muted/blocked accounts if supported, sessions where auth permits. Exclude decorative controls and unsupported export/delete claims. | Medium across independent settings. High utility and trust, but it is infrastructure rather than a distinctive new destination. Keep secondary navigation. |
| **12. Media Studio / publishing workspace** | Media Studio docs give More → Media Studio or studio.x.com and describe role-based media library/publishing/analytics access. Premium overview lists Media Studio for Premium and above. X Pro separately documents scheduled posts. [S16][S9][S17] | More → Publishing → Drafts / Scheduled / Media → compose or inspect asset usage. | Durable drafts plus a personal media library. Add scheduling only with a reliable server queue, timezone display, cancel/edit, and delivery states. Exclude video transcoding, live production, team permissions, ads, and monetization. | Medium for drafts/library; high for video/live and reliable scheduling. Useful for frequent authors, less valuable than Articles for an early community. |

## Jobs: keep three different products separate

### A. Employer Hiring: documented on X

The official flow is **Premium Business portal → Hiring → ATS integration or Add job → optionally feature on profile → share link → optionally promote**. Premium Organizations also describes integrating career-site positions and featuring openings. These are employer tools, not proof of a native applicant tracking product. The Business page offers Basic and Full Access tiers but the retrieved Hiring instructions do not clearly map Hiring entitlement to a specific tier. Do not claim a precise Business tier gate. [S1][S2]

### B. Candidate discovery: useful proposed scope, not an audited X flow

For social-web, propose **Opportunities → search/filter → detail → Apply on employer site**. Public official sources retrieved here establish discoverable/featured job listings but do not establish the full candidate search UI, saved-jobs flow, alerts, candidate tier requirements, or universal desktop placement. Any mockup of those controls should be labeled a social-web proposal. [S1][S2]

Proposed job detail fields: role title, organization, author, location, remote/hybrid/on-site mode, employment type, optional salary with currency and period, description, optional closing date, application URL, and open/closed state. Do not collect a CV to support an external application link. A private **Marked as applied** user action may be added later, but it must not imply employer receipt or selection status.

### C. Native applications: separate later decision

No official source retrieved here verifies platform-wide X native application forms, reusable CV storage, employer data access, applicant retention periods, or application-stage tracking. Absence in these results is not proof the feature does not exist.

The official **X Job Applicant Data Request** form is explicitly limited to **X Corp's own Recruitment Privacy Notice**. It must not be cited as evidence for applicants to third-party jobs distributed through X. [S18]

If social-web later adds native applications, treat that as a second subsystem: candidate review screen showing exact shared fields and recipient, explicit submission, receipt, employer-only applicant access, withdrawal/deletion behavior, and defined retention. Resume files would require private storage and short-lived authorized downloads. These are proposed requirements, not claims about X behavior. Avoid promising an application was delivered solely from a button click or external redirect.

## Shortlist interaction scope

### Opportunities: strongest distinct community utility

- Proposed routes: `/opportunities`, `/opportunities/:id`, `/opportunities/new`, `/opportunities/:id/edit`.
- Discovery: search, location/work-mode/type filters, clear/reset state, responsive cards, useful no-results screen.
- Reading: one primary external Apply action with destination domain; author profile and organization context; saved toggle; closed listings remain readable with application disabled.
- Publishing: authenticated member creates draft, previews, publishes, edits, closes; owner checks are server-side. Extra moderator removal rights require a separately defined role and permission model.
- Minimal data concepts: opportunity, private saved-opportunity relation, owner and visibility. Shared invite-only access applies to detail, search, and feed previews.
- Main tradeoff: a useful listing board still needs supply. Begin with member-created roles and projects; no external feed or ATS is required.

### Lists: quickest coherent addition

- Proposed routes: `/lists`, `/lists/:id`, `/lists/new`; membership editor can be a dialog.
- Library: Mine / Following / Discover. Creation asks name, optional description, and Private / Community visibility.
- Detail: existing post rendering with Posts / Members tabs. Empty lists explain how to add accounts. Hidden lists must not leak through search, direct URLs, notifications, or cached feeds.
- Minimal data concepts: list, member accounts, followers, optional pinned-order preference. “Community” means existing authorized app members, not the public internet.
- Main tradeoff: Lists improve reading but do not create a new content type or immediately solve a small, low-volume feed problem. Start without pinning if Home tab capacity is already tight.

### Articles: strongest publishing expansion

- Proposed routes: `/articles`, `/articles/new`, `/articles/:id`, `/articles/:id/edit`; profile has an Articles view.
- Editor: title, summary, optional cover, body; visible save status; preview; publish action; recover from a failed save; prevent accidental draft loss.
- Reader: readable width, headings, author/date, cover, accessible links, feed card back to the article. Reuse an existing reply mechanism only if its data contract naturally supports articles; otherwise defer comments.
- Minimal data concepts: article, draft/published status, owner, body representation, cover asset. Do not allow draft bodies into search/feed responses.
- Main tradeoff: editor correctness and comfortable reading matter more than a large toolbar. A constrained Markdown workflow can keep the first version tractable.

## Navigation proposal

Do not add twelve permanent sidebar rows. Keep Home, Explore, Notifications, Communities, and Profile; add the chosen destination to primary navigation only when it supports a frequent task. Place secondary modules under More. If all three shortlisted modules eventually launch, Opportunities can be primary while Lists and Articles begin under More; member usage can justify promotion later. Saved opportunities belong within Opportunities, separate from existing post bookmarks.

Retain the app's dark pixel identity with its bundled icon set. Route changes should preserve the shell and use content-area loading. Desktop list/detail layouts should collapse to sequential screens on narrow widths; active navigation, loading, empty, error, permission-denied, and closed/draft states are part of each module's design.

The [coordinator proposal](../specs/2026-10-01-sidebar-expansion-options.md) narrows these alternatives to Jobs first (external applications), private Lists next, and Articles later. Its `/jobs` routes supersede the illustrative `/opportunities` labels if that slice is selected. Native private applications remain a separate decision.

## Source quality and unresolved discrepancies

- **Articles tier:** the dedicated Articles page explicitly says Premium and Premium+; the generic Premium page's introductory summary places Articles under Premium+ while another section mentions Premium. Prefer the dedicated product page and keep the conflict visible. This report does not make a purchase recommendation. [S4][S9]
- **Chat privacy:** requests are unencrypted until accepted; metadata is not encrypted; including Grok changes data access. “X Chat is encrypted” is incomplete without those caveats. Our proposed message MVP must describe its actual implemented security. [S5]
- **Creator earnings:** official Creator Dashboard and Subscription documentation use different fee/payout descriptions. No revenue percentages or commercial assumptions are carried into this recommendation. [S11][S12]
- **Emerging surfaces:** Radar and current Chat are documented. Separate desktop Money/wallet, standalone video, and universal AI-agent menu destinations were not established by this research and should not be promised.
- Account tier, rollout, country, platform, and documentation age can alter availability. A later authenticated, explicitly authorized audit would be needed for an exact account-specific sidebar inventory.

## Official source register

Every source below was retrieved **2026-10-01**. Unless marked otherwise, evidence came from grounded public search excerpts. Links in the comparison map to this register.

- [S1] [Premium Business](https://help.x.com/en/using-x/premium-business) — official Help Center; read in full with Firecrawl; employer Hiring, portal, tiers, Radar, availability.
- [S2] [Premium Organizations](https://help.x.com/en/using-x/premium-organizations) — official Help Center; employer Hiring and organization features.
- [S3] [How to use X Lists](https://help.x.com/en/using-x/x-lists) — official Help Center; create/manage/follow/pin and documented desktop navigation.
- [S4] [About Articles](https://help.x.com/en/using-x/articles) — official Help Center; publishing, navigation, tiers, global availability.
- [S5] [About Chat](https://help.x.com/en/using-x/about-chat) — official Help Center; registration, messaging, encryption boundaries, Grok access.
- [S6] [About X Spaces](https://help.x.com/en/using-x/spaces) — official Help Center; listening/hosting and platform boundaries.
- [S7] [How to host a Space](https://help.x.com/en/using-x/spaces-hosting) — official Help Center; scheduling, roles, recording.
- [S8] [About Grok](https://help.x.com/en/using-x/about-grok) — official Help Center; conversational assistant and navigation.
- [S9] [About X Premium](https://help.x.com/en/using-x/x-premium) — official Help Center; tier overview and feature caveats.
- [S10] [X Premium how to](https://help.x.com/en/using-x/x-premium-how-to) — official Help Center; desktop navigation and subscription management.
- [S11] [Creator Dashboard](https://help.x.com/en/using-x/creator-dashboard) — official Help Center; earnings/subscriber dashboard and documented More path.
- [S12] [About Creator Subscriptions](https://help.x.com/en/using-x/subscriptions-creator) — official Help Center; eligible creator subscriptions.
- [S13] [Professional Accounts](https://help.x.com/en/business-and-advertising/professional-accounts) — official Help Center; free account type, Professional Home, rollout note.
- [S14] [How to access your X data](https://help.x.com/en/managing-your-account/accessing-your-x-data) — official Help Center; desktop Settings path and archive request.
- [S15] [Personalization and data settings](https://help.x.com/en/personalization-data-settings) — official Help Center; data controls.
- [S16] [Media Studio Overview](https://help.x.com/en/using-x/media-studio) — official Help Center; documented More entry point and permissions.
- [S17] [About advanced X Pro features](https://help.x.com/en/using-x/advanced-postdeck-features) — official Help Center; scheduled posts and Lists workspace.
- [S18] [X Job Applicant Data Request](https://help.x.com/en/forms/privacy/job-applicant-data-request) — official Help Center form; applies only to X Corp recruitment.

[S1]: https://help.x.com/en/using-x/premium-business
[S2]: https://help.x.com/en/using-x/premium-organizations
[S3]: https://help.x.com/en/using-x/x-lists
[S4]: https://help.x.com/en/using-x/articles
[S5]: https://help.x.com/en/using-x/about-chat
[S6]: https://help.x.com/en/using-x/spaces
[S7]: https://help.x.com/en/using-x/spaces-hosting
[S8]: https://help.x.com/en/using-x/about-grok
[S9]: https://help.x.com/en/using-x/x-premium
[S10]: https://help.x.com/en/using-x/x-premium-how-to
[S11]: https://help.x.com/en/using-x/creator-dashboard
[S12]: https://help.x.com/en/using-x/subscriptions-creator
[S13]: https://help.x.com/en/business-and-advertising/professional-accounts
[S14]: https://help.x.com/en/managing-your-account/accessing-your-x-data
[S15]: https://help.x.com/en/personalization-data-settings
[S16]: https://help.x.com/en/using-x/media-studio
[S17]: https://help.x.com/en/using-x/advanced-postdeck-features
[S18]: https://help.x.com/en/forms/privacy/job-applicant-data-request
