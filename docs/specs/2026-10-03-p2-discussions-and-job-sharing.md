# Subject discussions and structured job sharing

Date: 2026-10-03
Status: Approved scope; local implementation in progress. Database migration deployment is separate.
Parent: [UI and UX improvements](2026-10-03-improvements-spec.md).

The owner authorized completing the active specifications, including the P2 exploration. This document freezes the implementation contracts before adding schema-backed functionality. Competitor observations are background evidence, not API or audience definitions.

## Canonical subjects

- A subject belongs to exactly one community. Identity is `(community_id, normalized_title)`; the same title in another community is a separate discussion.
- Titles contain 3–120 characters after collapsing whitespace and trimming. PostgreSQL generates the authoritative identity with `lower(public.normalize_subject_title(title))`. Punctuation and diacritics remain significant. Display casing is retained. Client validation may normalize whitespace but does not decide duplicate identity.
- Subject creation returns the existing canonical subject when its title/community identity already exists, including concurrent requests. It never silently creates an entry. The member reviews and submits an entry separately.
- Titles and community associations are immutable. Subjects persist when individual entries are removed. Removing the subject creator's account clears `created_by` rather than deleting other members' entries; deleting the associated community cascades its subjects.
- Directory state is `q`, `communityId`, `filter=all|following|saved`, `cursor`, and `cursorHistory`. Directory pages sort by subject creation time and ID descending. Search escapes SQL wildcard characters. Filter changes reset pagination.
- Canonical detail URLs are `/subjects/:id`. Deep links work independently of directory navigation. Detail entry pagination preserves directory return state separately from its ascending entry cursor.

## Audience and publishing

The existing migration makes communities and community posts readable by all authenticated members. Publishing requires current community membership. Subjects use that same audience: authenticated members can discover and read; joined, onboarded members can create subjects and add entries. No public/anonymous route is introduced.

Entries are dedicated plain text, 1–2,000 characters after trimming. They do not convert existing posts, article titles or personal drafts into subjects. Entry order is oldest first by `(created_at,id)` with a scoped cursor and previous-page history. Entry counts and latest known entry times come from actual rows.

The detail page presents community/title, availability, entry count, chronological entries and an explicitly submitted entry form. A non-member sees a community link explaining that joining enables publishing. A locked subject remains readable and disables new entries. Failed publishing retains the entered text; pending publishing cannot be submitted twice.

## Follow, save and moderation

- Follow and Save are separate private per-account relationships with idempotent PUT/DELETE mutations.
- Follow enables a followed-subject directory view. It does not promise alerts or notifications. Save enables the saved-subject view. Neither exposes aggregate follower/save counts.
- Relationship removal remains available for the owner's reference if its source is no longer available. Community deletion cascades the reference rows.
- Entry authors can delete their own entries. The associated community owner can delete entries and lock/unlock subjects. Deletion has an explicit confirmation and visible pending/error handling.
- Subject lock/unlock uses an expected version. The status update locks the subject row, checks community-owner authority, and rejects stale versions. Database triggers enforce immutable identity and advance version/time.
- Entry creation locks the subject row against status changes, verifies open status and current membership, and cannot race a completed subject lock. Direct authenticated SQL receives the same constraints through RLS/triggers.
- A dedicated reporting/appeal system, administrator roles, cross-community title merges and automated moderation are separate future decisions.

## Storage and API

New tables: `discussion_subjects`, `discussion_entries`, `subject_follows`, `subject_saves`. All enable RLS, revoke anonymous access, and grant only necessary authenticated operations. A new additive SQL migration defines canonical normalization, constraints, indexes, policies and guarded triggers. Existing authentication tables and historical content are not rewritten.

API resource routes:

| Route | Contract |
| --- | --- |
| `GET /api/subjects` | Directory with title/community/view filters and scoped descending cursor |
| `POST /api/subjects` | Create or reuse canonical subject from `{communityId,title}`; no entry body |
| `GET /api/subjects/:id` | Subject metadata and viewer state |
| `PATCH /api/subjects/:id` | Community-owner `{status,version}` update |
| `GET /api/subjects/:id/entries` | Scoped ascending entry page |
| `POST /api/subjects/:id/entries` | Current joined member submits `{body}` |
| `DELETE /api/subjects/:id/entries/:entryId` | Author or community owner removes an entry |
| `PUT/DELETE /api/subjects/:id/follow` | Private followed state |
| `PUT/DELETE /api/subjects/:id/save` | Private saved state |

All services receive the authenticated `Transaction` through `withUser`. New API paths must match explicitly rather than accepting extra or empty segments. Cursor timestamps preserve database microseconds. There are no invented totals, ranking signals or counts derived from partial pages.

## Structured job sharing

A published, accessible job can be attached to a reviewable social composer draft via `Akışta paylaş`. Opening that draft does not publish. Existing unsent composer text/images require the established replacement guard. Durable draft save/resume must retain the job reference and resource version contracts.

- `threads` and `text_drafts` add `resource_kind=null|'job'` and nullable `job_id` referencing jobs with `ON DELETE SET NULL`.
- A deleted job retains `resource_kind='job'` as an unavailable-resource marker. No title/company/application URL snapshot survives deletion through the reference.
- `POST /api/threads` accepts an optional job ID; the server derives the resource kind. New sharing requires a currently published, visible job. Owner-private job drafts cannot be attached.
- Reads hydrate current job title/company/location/working conditions/status/deadline into `jobReference`, or an unavailable marker. The application's normal account and post/community audience remain in force.
- The feed card links to the canonical job detail. It does not embed a direct Apply action that can become stale. Closed/expired jobs display their current availability; deleted/unreadable jobs show a clear unavailable state without hidden metadata.
- Replies do not gain unrelated structured job attachments. Existing reposts reference the original post and its current hydrated job state.

Sharing a URL through native share/copy and creating a social composer draft are distinct actions. Neither records an application or alters an external site.

## UI and acceptance

Use existing dark surfaces, readable text, bundled Pixelarticons, shared feature headers/sections/states and 44px standalone controls. Add `Başlıklar` through secondary navigation; retain five mobile destinations. Directory chrome survives result refresh. Empty states distinguish no subjects, no matches, no followed subjects and no saved subjects. Failures keep filters/text and provide a retry or safe return path.

Required implementation checks cover 320/375/768/1440px layouts; canonical duplicate reuse; membership and locked-state publishing; independent Follow/Save; author/owner moderation; oldest-first pagination; Back/Forward return state; unavailable job attachments; composer guard/draft persistence. Root coordinates static/build/browser checks. No migration is applied to an external database as part of local implementation.

## Delivery boundary

This slice implements canonical subject reading/publishing and structured job references. It does not introduce popularity algorithms, topic alerts, company authorization, a public audience, rich-text entries, subject covers or cross-community title merging. Database deployment and remote publication require their own authorized step.
