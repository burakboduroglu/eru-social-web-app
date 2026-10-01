# Community reposts

Date: 2026-10-01
Status: Locally implemented; migration 008 awaits separately authorized application.

Joined members can repost community roots. Replies remain ineligible. The API and
database insert policy enforce current membership and original source visibility;
the original is referenced, never copied into a wider audience.

Profile timelines show community repost activities only to current source-community
members, and only while the actor is also a member. Frozen pages recheck membership,
source RLS, the exact repost timestamp, deletion and dismissal before rendering.
The existing source community link and original author remain on every post card.
Following and private account Lists retain their personal-root-only contract.
Home and joined-community feeds retain original-post rendering and hydrated repost
state/count; this slice does not change ranking or introduce new activity entries.

Reposts remain unique per actor/source. Undo is idempotent and allowed for the owner
after leaving the community or losing source access. Unreadable originals expose no
count. Deleting the source cascades to its reposts. Existing source/community RLS and
original-post discovery behavior remain unchanged.

Migration: `202610010008_community_reposts.sql`. No remote mutation, commit or push is
part of local implementation and validation.
