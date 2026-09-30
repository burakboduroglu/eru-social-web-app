# Compact pixel UI

## Scope

Polish the existing social interface with readable library icons, consistent pixel characters and illustrations, compact dropdowns, and clear discovery states. Keep existing API payloads and authentication behavior.

## Requirements

1. Replace custom interface icon paths with a consistent, locally bundled pixel icon library. The GIF control must be recognizable at its rendered size. Preserve accessible labels and monochrome theme colors.
2. Render the five empty/error/auth illustration states with small native pixel scenes. Use deterministic pixel characters for missing/broken avatar images; uploaded photos remain supported.
3. Keep characters inside their avatar boxes. The personal-profile and community choices must have identical avatar dimensions and consistent row geometry, regardless of image source.
4. Make the personal-profile trigger smaller and padded. Adopt these project design targets: 12px trigger text, 6px vertical / 10px horizontal padding, 28px menu avatars, 40px minimum menu rows, 13px menu labels, and a 272px menu width constrained by the viewport. These are chosen project values, not measured X.com dimensions.
5. Keep dropdown text within its row. Truncate long destination names, wrap long action labels when needed, and bound menu scrolling. Support outside click, Escape, arrow keys, Home/End, focus restoration, and query reset without losing the selected destination.
6. Remove the Explore introduction containing “KEŞFET”, “Yeni kişiler, yeni topluluklar”, and “İlgi alanlarına yakın sohbetleri ve insanları bul.” Preserve search, people/community sections, and compact empty states.
7. Explain community discovery accurately. The existing API lists communities by creation time; `/me` returns the three newest communities the user has not joined as suggestions, and memberships separately. Empty-query search also excludes joined communities. This is a recency filter, not personalized interest ranking. Use “Katılabileceğin topluluklar” and “Henüz katılmadığın başka topluluk yok.” so membership and suggestion sections are understandable. Source: `server/api.ts` and `server/repository.ts`.
8. Move sign-out into the three-dot account dropdown in the desktop account area and mobile top bar. Keep busy/error handling and accessible keyboard operation.

9. Use quiet, slim scrollbars for the document, sidebar, dropdowns and picker surfaces. Choose 4px for WebKit scrollbar styling with `thin` as the standard browser fallback. Platform overlay scrollbars may follow OS settings.

10. Make search fields compact and proportional in Explore and the right sidebar. Use a 38px field height, bounded width, and fixed-size search/clear controls. Keep suggestion avatars and text aligned.
11. Open GIF and emoji pickers as floating overlays anchored to their controls, without increasing composer height or moving the feed. Prefer above the active control when there is room, otherwise position within the visible viewport. Keep them visible and internally scrollable on mobile. Show loading, empty, retryable errors and thumbnail failures. Support the shared local catalog and personal Supabase upload archive described in requirement 25.

12. Add a pixel calendar icon alongside the profile joining date.
13. Normalize shared page headers, including communities and community creation: consistent 56px minimum height, title/action alignment, padding, and a visible bottom divider. Keep sticky-tab offsets aligned with header height.
14. Place the personal-profile destination dropdown in the composer's upper-right corner; anchor its menu from the right.
15. Ensure post overflow menus have an opaque surface and render above sibling posts and post click overlays.
16. Repair the emoji picker so it shows only its active compact panel and does not spill its full contents over the page. GIF and emoji selection must be mutually exclusive.

17. Add balanced spacing between profile name, handle, biography and joining date, and between editor fields.
18. Audit responsive layout at 320px, 375px, 768px, 1024px and 1440px. Fix overflowing search fields and any shell/header/menu width errors at their source; do not hide them with global horizontal clipping. Keep sticky headers/tabs below the mobile top bar and wrap long unbroken profile/community names and biographies.

19. Align the destination dropdown trigger and publish button to the same right edge and the same 156px width, preserving their existing individual heights.

20. Render the liked heart as a solid pixel silhouette; the unliked state remains outlined.
21. Keep emoji category navigation and search visible and functional inside the picker. Avoid rendering all categories outside the panel or freezing interaction.

22. Remove bright white focus rings/borders when focusing text inputs and textareas. Keep a restrained non-white focus indication without changing field geometry.

23. Simplify post details to a focused X-style layout: full-width main content, a compact author/header row, a separate date, one action row with counts beside reply/like icons, an inline multiline reply composer, and replies below it. Avoid duplicate engagement-count sections.
24. Detect links in typed/pasted text and display clickable readable links. Show available page metadata automatically as a compact preview both before publishing and in posts, preserving known media embeds. Use at most one general preview per post and graceful fallback for unsupported or inaccessible pages.
25. Add a locally bundled, openly licensed shared GIF starter catalog with search/categories, available without provider APIs or keys. Retain personal uploads.

26. Align the communities page title and create action on a consistent header row, including desktop and narrow screens.
27. Update README to describe completed UI features and use the latest user-supplied 2026-09-30 22:08:46 screenshot unchanged. Use the same exact PNG in the portfolio's social-web screenshot entry with its actual 2880×1800 dimensions.
28. Replace inline publishing success text with a compact, dismissible toast at the top of the viewport. Announce success accessibly, expire automatically, and preserve composer/feed geometry.
29. Show the community destination above the author name within the text column on community posts, linking to that community. Keep it out of the avatar column. Apply the same hierarchy in feeds, details and replies when community data is present.
30. Use “Ana Sayfa” as the home navigation and accessible page heading label.
31. Show successful link-copy and native sharing confirmations in the same top toast. Keep copying in the post's three-dot dropdown, failures accessible, and cancelled native sharing quiet. Use a brief entry animation with reduced-motion support.

## References and decisions

- X Engineering describes click-anchored overflow dropdowns on wide screens and viewport-dependent presentation; it does not specify menu/avatar pixel dimensions: https://blog.x.com/engineering/en_us/topics/infrastructure/2019/progressively-enhancing-desktop-devices
- Use X as a density reference while preserving this application's pixel appearance. Avoid adding decorative discovery banners or changing feed ranking.
- Pixelarticons 2.4.1 provides the consistent MIT icon set: https://github.com/halfmage/pixelarticons and https://www.npmjs.com/package/pixelarticons. The package has no GIF asset, so the GIF control uses a small local badge.
- All icon assets must be bundled locally; no runtime icon CDN requests.

## Acceptance

- TypeScript and production build succeed.
- Desktop and 375px mobile previews have no horizontal menu overflow.
- Personal-profile/community rows have equal 28px avatars; nested SVGs fit inside them.
- Long community names remain inside the dropdown, and the trigger has visibly smaller padded text.
- Search and menus work with keyboard navigation and dismiss correctly.
- Sign-out appears only after opening account options.
- Explore has no removed introduction; community empty-state wording matches membership filtering.

## Validation boundary

Review UI against temporary local fixtures without writing to live accounts or services. Do not treat fixture membership or API responses as live backend verification.

## Implementation checklist

- [x] Bundled Pixelarticons and consistent icon geometry.
- [x] Pixel scenes and seeded character avatars.
- [x] Compact proportional menus and equal avatar sizes.
- [x] Smaller padded destination trigger positioned at top right.
- [x] Explore introduction removed and discovery wording corrected.
- [x] Three-dot account dropdown contains sign-out.
- [x] Slim scrollbars and compact search/sidebar sizing.
- [x] Profile date icon integration and consistent shared headers.
- [x] Opaque post menu layering verified in the browser.
- [x] Filled liked heart state.
- [x] GIF archive rendering and empty/error handling verified in the browser.
- [x] Emoji category navigation, search, bounded rendering and dismissal verified in the browser.
- [x] Profile spacing and responsive checks across the target widths.
- [x] Final typecheck/build and desktop/mobile validation.
- [x] Communities header alignment and README screenshot update.
- [x] Input focus treatment removes the bright white ring across shared fields.
- [x] X-style detail page and multiline replies.
- [x] Automatic links/metadata previews in composer and posts.
- [x] Shared keyless GIF catalog with real licensed assets.
- [x] Floating GIF/emoji overlays keep composer/feed geometry unchanged and fit desktop/mobile viewports.
- [x] Publishing success appears in a top toast instead of inline form text.
- [x] Community destination appears above the author on community posts.
- [x] Home label uses “Ana Sayfa”; detail action icons include counts without a duplicate counts block.
- [x] Copy/share success uses the top toast; portfolio references the exact latest screenshot.

## Validation results

- `bun run build` passed, including `tsc --noEmit`; `git diff --check` passed.
- Final browser checks loaded the actual stylesheet imports with local API/storage fixtures. Document widths matched viewports at 320, 375, 768, 1024, 1055 and 1440px; Explore search stayed 38px high and within its column.
- At 375px, destination and publish controls were both 156px wide; all target-menu avatars were 28×28px.
- Profile, communities and community-creation headers measured 56px high with a 1px bottom divider. Profile copy had an 8px gap, and the date calendar rendered.
- Post menu computed an opaque `rgb(16, 18, 21)` surface and the open card had an elevated stacking order. Account options exposed sign-out and dismissed with Escape.
- Emoji search returned matching results; category navigation moved the internal scroll area. At 375px, the emoji host was 329×352px and the category scroll viewport was 263px high, keeping its longer content inside the panel.
- GIF fixtures verified uppercase `.GIF` loading, a successfully decoded thumbnail, empty/archive-error/retry flows, and selection inserting the URL while closing the picker and restoring trigger focus.
- No live GIF upload, account mutation or sign-out was performed. These initial archive checks precede the bundled shared catalog revision described below; general internet GIF search remains outside scope.

## Picker placement revision

The latest user request replaces the earlier in-flow picker placement. Both selectors must appear over the page content, with viewport-aware anchoring and no layout shift. Existing search, category navigation, archive handling and dismissal behavior remain acceptance criteria.

## Final revision validation

- `bun test` passed all 69 tests across 9 files, with 329 assertions. Tests use isolated PGlite, injected DNS/transport responses and a loopback-only HTTP fixture; no live account or remote database writes occurred. The loopback transport test required sandbox escalation to bind its local port.
- Production build/typecheck and `git diff --check` passed. Final fixture document width matched 320, 375, 768, 1024, 1055 and 1440px viewports. Sidebar and Explore search fields measured 38px high.
- At 1440px, opening the GIF overlay changed both composer height and first-post position by 0px. The panel was portaled into `document.body`. At 320×340px, the emoji panel occupied x12/y12, 296×206px and remained inside the viewport; only one picker was open.
- All 14 shared GIF thumbnails decoded in the browser. Searching “alkış” returned the applause asset. Catalog tests confirmed every file has multiple animation frames and matches its recorded source checksum. Same-origin GIFs also rendered as post images on localhost with a development port.
- Ordinary links produced readable anchors and a metadata card in posts and drafts. Reply action focused the multiline reply textarea; its automatic metadata preview also rendered. Unsupported/blocked preview behavior, private DNS/redirect rejection, image handling, limits, timeout, cache and pinned transport are covered by targeted tests.
- Community label and author heading shared the text-column x64 position at 375px, while the avatar stayed in the x12/x16 gutter. Detail author/avatar rows aligned at y150, action counts showed 2 replies and 4 likes, and there was no duplicate counts section.
- Simulated publishing displayed “Gönderi paylaşıldı.” at the top of the viewport, cleared the draft and left no inline success text. Mocked clipboard copying closed the post dropdown and displayed “Bağlantı kopyalandı.” in the same toast. No real clipboard or account mutation was needed.
- Communities title/create action vertical centers matched at desktop (27.5px) and mobile (81.5px). Mobile page headers used a 54px top offset and profile tabs 110px. Profile copy retained an 8px gap, calendar icon and wrapping for a 60-character name plus a 250-character URL biography without widening the document.
- README and portfolio use the exact latest owner-supplied 2880×1800 PNG, with equal bytes and SHA256 across both copies. Only the portfolio's social-web screenshot registry entry and new PNG were changed; no commit, push or deployment was performed.

## Remaining work

No requested implementation items remain open. Additional X feature opportunities are recorded separately in `docs/design/x-ui-opportunities.md` and are a future backlog, not unfinished work in this specification.
