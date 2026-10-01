# Sidebar expansion: feature options and proposed first slice

Date: 2026-10-01
Status: Research-backed proposal; no application implementation authorized or performed in this round.
Baseline: `3503585`; working tree was clean before this research.
Research: [Astra sidebar module review](../design/2026-10-01-x-sidebar-modules-research.md).

Later execution decisions: [Medium feature scope](2026-10-01-medium-features.md) and [deferred costly features](2026-10-01-deferred-costly-features.md) supersede this round's research-only status.

## Goal

Add useful destinations beyond the current conversation loop. The owner specifically
mentioned job applications as an example and requested a broader review of X's
sidebar-accessible modules. This document proposes social-web behavior; it is not
a claim of visual parity or a reconstruction of X's current authenticated menu.

## Verified local starting point

`src/router.tsx:sidebarLinks` defines Home, Explore, Notifications, Communities and
Profile. The same array currently renders desktop and mobile navigation.
`src/components/account-menu.tsx` exposes saved posts and sign-out. Jobs, applications,
account lists, articles, direct chat, live audio and creator analytics have no routes
or response contracts in `src/router.tsx` or `shared/types.ts`.

The existing application has invite-only access, onboarding, people search, follows,
cursor/snapshot timelines, private bookmarks, image attachments, durable activity and
personal reposts. These are reusable patterns, not permission to reuse their tables
for unrelated resources. Source: current router, shared contracts and SQL migrations.

## Outside references and verification limits

- X Lists group accounts and provide their posts as a separate timeline, with private
  and public lists and pinning. The help page documents desktop navigation access.
  [Official Lists help](https://help.x.com/en/using-x/x-lists).
- X Articles provide long-form writing and publishing, with a documented side-navigation
  entry. Current dedicated documentation names Premium, Premium+, Premium Businesses
  and Premium Organizations as eligible publishers. Product documentation may disagree
  between overview pages; do not copy eligibility rules into social-web.
  [Official Articles help](https://help.x.com/en/using-x/articles).
- X's business documentation describes Hiring through employer tools, including manual
  or ATS-backed listings and featured jobs. This confirms the employer capability,
  not the exact candidate menu, native application screens or application persistence.
  [Official Premium Business help](https://help.x.com/en/using-x/premium-business),
  [Official Premium Organizations help](https://help.x.com/en/using-x/premium-organizations).

All sources were retrieved on 2026-10-01. No authenticated X visual audit was performed.
The following flows and priorities are social-web proposals, not inferred X facts.

## Three implementation approaches

| Approach | Result | Tradeoff |
| --- | --- | --- |
| Curated social tools | Lists first, then long-form writing | Builds on existing content; requires little new content supply |
| Professional opportunities — recommended for the owner's example | Jobs first, with external applications; Lists next | Adds a distinct purpose, but somebody must publish useful jobs |
| Broad platform expansion | Chat, audio, AI, paid tiers and creator tools together | Adds operating and product responsibilities before their value is established |

Recommended order: **Jobs → Lists → Articles**. If there is no initial source of useful
job postings, reverse the first two. This order is a product judgment, not a measured
conversion or performance result. Native applications are a separate Jobs slice.

## Navigation contract

Desktop can promote Jobs as a named destination. Lists, Articles, Saved and future
tools live in a separate `Daha fazla` menu until their usage justifies promotion.
Preserve the existing visual identity and bundled Pixelarticons.

Do not append every new desktop item to the mobile bottom bar. Separate the desktop
navigation configuration from the current five mobile destinations. Offer secondary
tools from a labeled mobile menu/drawer with the same routes and active states.

The secondary menu must handle keyboard navigation, Escape, focus restoration,
bounded scrolling and touch targets. Account actions should remain identifiable as
account actions. Sidebar navigation scrolls independently when taller than the
viewport, leaving the account control reachable. Empty/unimplemented features do not
appear as working menu links.

## J1: Jobs with external applications

### Reader flow

`İş İlanları` → search/filter listings → inspect detail → save or open the employer's
application destination. Proposed routes: `/jobs`, `/jobs/:id`, `/jobs/new` and a
saved filter within `/jobs`. There is no native `Başvurularım` in this slice.

The listing page uses the existing central column: search, location/work-mode/type
filters and a cursor-paginated list. Cards show role, company name, location,
work mode, posting date and a saved state. Selection opens a detail page on mobile;
a desktop preview pane is optional, not required for the first implementation.

Details show the full description, requirements, publisher profile, expiry/closed
state and an explicit external-application action. Display the destination domain
before leaving. Opening a link does not mean an application was submitted; do not
invent a submitted status or applicant count.

### Publisher flow and ownership

Onboarded members can create their own listings, preview, publish, edit and close
them. Company text is supplied by the publisher; it is not verified-company status.
Community association is optional and may only use joined communities. A community
owner does not automatically gain access to every publisher's applications.

Proposed resources: `jobs` and `job_saves`. Store owner, title, company display name,
description, location, work mode, employment type, safe application URL, optional
community, optional deadline, status and timestamps. Salary display, taxonomy and
validation limits remain design choices to freeze before implementation.

RLS preserves owner mutations, private saves and the invitation-only reader audience.
Drafts are owner-only; closed listings remain readable with their application action
disabled. Reject unsafe URL schemes. External application pages remain external;
the app does not fetch or submit their forms.

### Acceptance and excluded scope

Search/filter state survives navigation; cursor state resets when filters change.
Saved-job state is account-scoped and rolls back on failure. Missing/deleted/closed
jobs have distinct states. A non-owner cannot edit or close another member's listing.
Back navigation restores selection/filter context. Check desktop and narrow mobile
layout with long titles/company names and failed mutations.

Exclude ATS sync, external job aggregation, employer verification, paid promotions,
CV uploads, matching scores, recommendation models and automatic applications.
Existing post-image Storage registration cannot silently become CV storage.

## J2: Native applications, if chosen

This is a new private workflow, not a relabeling of clicking an external link.
Proposed routes: `/jobs/:id/apply`, `/applications` and a publisher-only inbox for
their listing. A job has an explicit application mode; external-only jobs cannot
produce internal submitted records.

First native version can submit a short message and explicitly selected profile
data. Before submission, show the recipient, the exact shared fields and an accurate
confirmation. Require an intentional submit action. Avoid CV files in the first
version; files need a separate private Storage/authorization contract.

Proposed `job_applications` stores job, applicant, submitted content, status and
timestamps. Only the applicant and that job's verified owner can read it. General
community members cannot see applications. Freeze duplicate submission, withdrawal,
job closure, edits, deletion/retention and publisher status transitions before code.
Activity may notify the publisher/applicant, with private routes and no sensitive
application text in public previews. Implement actual retention/deletion behavior,
not a UI promise unsupported by persistence.

## L1: Account Lists

Proposed routes: `/lists`, `/lists/new`, `/lists/:id` and `/lists/:id/members`.
Create a named private list, find accounts using existing people search, add/remove
them, and read a timeline limited to list members. This curates accounts; Saved
continues to save individual posts.

Proposed resources: `account_lists` and `account_list_members`, with owner-scoped
RLS. Start private; authenticated shared lists, subscriptions and pinning are later
slices. Membership does not alter global following. List timelines hydrate posts
under current authorization and use viewer/list-scoped cursor snapshots. Define
community-post inclusion explicitly before implementation.

Handle removed accounts, empty membership, no posts, rename, deletion and stale
timeline cursors. Reuse response-ordering/draft/error patterns, not an assumed
general-purpose feed API that does not yet exist.

## A1: Long-form Articles

Proposed routes: `/articles`, `/articles/new` and `/articles/:id`.
Start with title, summary, text/Markdown body, preview, draft and published states.
Save drafts under owner authorization with visible save/failure state and version conflict handling. Preserve unsent edits. A published article has a stable link and author attribution.
Keep audience within authenticated members. Avoid premium gating in social-web.

Use a dedicated `articles` resource and owner-scoped draft access. Sanitized rendering
and link handling need an explicit contract. Existing post text limits are not article
limits. If cover/media assets are included, their registration/reference/deletion
contract must cover article references before using the public image bucket.

Exclude a block editor, imported HTML, paywalls, collaborative editing and video
uploads from the first slice. Decide how published edits affect stable links and
activity before implementation.

## Next decision

Choose the first module and freeze its scope before implementation. For Jobs,
separately choose external application links versus the native private J2 workflow.
The research report provides the remaining candidates and their dependencies.
No new app routes, migrations, remote writes, dependency installs, commits or pushes
are part of this research round.
