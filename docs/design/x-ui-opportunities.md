# X UI opportunities for social-web

**Reviewed:** 2026-09-30
**Status:** Research only; none of these suggestions are approved implementation work.

## Scope and evidence

The public X.com page could not be opened in the isolated browser session (`net::ERR_HTTP_RESPONSE_CODE_FAILURE`), so this comparison does not claim a live visual audit. The suggestions below use X Help Center and Engineering documentation, then compare those documented workflows with this repository. Measurements and feature priorities are product recommendations for social-web, not X specifications.

The repository currently supports text posts and replies, likes, link sharing, dismissal, deletion, profile/community search, community membership and posting, and a recommended feed plus a joined-community feed. The composer has emoji selection and a user-owned GIF upload archive; `PostContent` renders supported URLs for images, video, GIF, YouTube, and Spotify. The composer does not have a general photo/video attachment control. Notifications currently return replies to the viewer's posts from the last 24 hours. The schema/API have no bookmark, follow, repost, mention-notification, poll, or direct-message feature. Community suggestions are the three newest communities the viewer has not joined; there are no community topics, rules, join requests, roles, or report actions.

X's official Help Center documents private bookmarks and a separate saved-post timeline; its post guide supports photo/GIF/video attachments; its notification timeline includes likes, reposts, replies, mentions, and follows with filters. The Community guide describes audience selection, join flows, and moderation roles. X Engineering describes viewport-aware action sheets: a click-anchored dropdown on wide screens and a half-sheet on narrow screens. The existing social-web UI has already adopted compact, viewport-bounded dropdown patterns, so this is a design reference rather than a proposed feature.

## Recommended additions

| Priority | Addition | Benefit / effort | Concrete UI and product behavior | Backend work |
| --- | --- | --- | --- | --- |
| 1 | Private saved posts | High / medium | Add “Kaydet” to the post actions and a “Kaydedilenler” page. Let the owner remove a saved post from either its action or that page; state clearly that saves are private. | Add a unique `(user_id, thread_id)` relation, authenticated save/remove/list endpoints, and pagination. Keep saves separate from feed dismissal. |
| 2 | Direct photo/video attachments | High / medium-high | Add a pixel attachment control beside GIF/emoji. Show compact previews, per-item remove controls, upload progress/errors, and a clear size/type limit. Preserve the existing text, emoji, and GIF flows. | Reuse the existing `post-media` storage path carefully. The current post API accepts text only, so add media validation and a durable association/representation rather than relying on arbitrary pasted URLs. |
| 3 | Repost | High / medium-high | Add a distinct repost action with an active state and attribution in feeds/profile timelines. Keep external “Share” separate. Prevent duplicate reposts and provide undo. | Add a unique user/post repost relation, toggle/remove endpoint, count, and feed hydration/ranking behavior. Decide whether quoted posts are in scope separately. |
| 4 | Follow people and a Following feed | High / high | Add follow/unfollow on profiles, follower/following counts, and a “Takip edilenler” feed beside “Senin için” and “Toplulukların”. | Add a directed follow relation, privacy/authorization rules, list/count endpoints, and a paginated feed query. |
| 5 | Broader notifications with filters | Medium-high / high | Extend the current reply-only page with “Tümü”, “Yanıtlar”, and “Bahsetmeler” filters, plus compact actor grouping for repeated activity. Add likes/reposts/follows after those actions exist. | The current endpoint derives recent replies only and has no notification/event table. Add an event model or carefully defined derived queries, unread/read state if needed, and category filtering. Implement mention parsing before promising mention notifications. |

## Later opportunities

- **Community discovery by topic:** suggestions are currently recency-based, not personalized. Add explicit topic tags and let people choose interests before attempting recommendation ranking. This needs community topic data and a clear empty-state path.
- **Community safety tools:** if communities grow, add visible rules before joining and report/hide controls, followed by owner/moderator roles and review queues. X's community documentation describes these workflows; social-web currently has only a creator identity and open membership.
- **Browser push:** defer until in-app notification categories are reliable. X documents web notifications for likes, replies, mentions, follows, and reposts; enabling push here would also require user permission, subscription storage, delivery infrastructure, and notification preferences.

I would not copy X's broader surface area yet (DMs, Spaces, polls, trending topics, or paid verification). Those features add substantial moderation, service, or feed complexity, while the five recommendations above improve the existing post/community loop directly. Preserve the app's pixel-art identity and compact controls when adding them.

## Sources

- [X Help Center: About Bookmarks](https://help.x.com/en/using-x/bookmarks) — saved-post timeline and private visibility.
- [X Help Center: How to Post](https://help.x.com/en/using-x/how-to-post) — post text and photo/GIF/video attachments.
- [X Help Center: About the Notifications timeline](https://help.x.com/en/managing-your-account/understanding-the-notifications-timeline) — activity types and notification filters.
- [X Help Center: Join a Community on X](https://help.x.com/en/using-x/communities) — audience selection, membership, and community moderation.
- [X Engineering: Progressively Enhancing Desktop Devices](https://blog.x.com/engineering/en_us/topics/infrastructure/2019/progressively-enhancing-desktop-devices) — viewport-dependent action sheet/dropdown behavior.

## Local implementation references

- `src/ui.tsx` — composer and post actions.
- `src/pages/social.tsx` — profile, search, community, and notification pages.
- `src/components/post-content.tsx` — URL-based media rendering.
- `src/components/gif-picker.tsx` — user-owned GIF archive/upload flow.
- `server/api.ts` — current thread, like, membership, search, and reply-only notification endpoints.
- `server/db/schema.ts` — current profile, community, membership, thread, like, and dismissal tables.
