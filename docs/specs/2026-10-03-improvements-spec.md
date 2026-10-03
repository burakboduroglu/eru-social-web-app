# UI and UX improvements spec

Date: 2026-10-03
Status: P0/P1 UI implementation complete; local validation and visual evidence recorded. See the [implementation review](2026-10-03-ui-implementation-review.md).
Baseline: `d94a914`, clean worktree at the start of the audit.

## Product direction

Build a social product where members discover jobs, share experience, and participate in community discussions. Jobs need a dedicated discovery and decision flow; the social timeline needs compact, readable attribution; discussions can gradually become easier to discover by subject. Retain the existing dark pixel identity, React/Vite/TanStack Router/Bun stack, bundled Pixelarticons, and current authentication boundary.

This direction comes from the owner's request on 2026-10-03. The dimensions and interaction contracts below are **social-web design decisions**, not measurements copied from competitors. Existing resource and visibility contracts are documented in the [medium feature spec](2026-10-01-medium-features.md) and [community repost spec](2026-10-01-community-reposts.md).

## Research and evidence boundaries

| Source | Verified evidence | Application to social-web |
| --- | --- | --- |
| [Kariyer.net job listings](https://www.kariyer.net/is-ilanlari), [remote listings](https://www.kariyer.net/is-ilanlari/remote-cagri+merkezi+operatoru), [city planning listings](https://www.kariyer.net/is-ilanlari/sehir+plancisi) | Retrieved official page content exposes selected filters, clearing filters, role/company, work location/mode, employment type and date information. Direct browser access to the general listing page returned an access denial. Current visual dimensions were not verified. | Show active filters and a reset action; make role, company and working conditions easy to scan. Keep only filters supported by our data. |
| [LinkedIn public job search](https://www.linkedin.com/jobs/search/) | Browser inspection after dismissing a sign-in suggestion exposed role/company search, location, filter controls, a result list, a separate selected-job area, and Apply/Save actions near its heading. This was a guest view, not a signed-in account audit. | Separate search from refinements; provide a list/detail workspace on sufficiently wide screens and prominent applicant actions. |
| [LinkedIn search help](https://www.linkedin.com/help/linkedin/answer/a511260), [saved jobs help](https://www.linkedin.com/help/linkedin/answer/a513247/managing-jobs-you-saved-on-linkedin?lang=en-us&intendedLocale=en) | Official instructions describe query/location search, refining results, opening details, saving jobs and managing saved jobs through My jobs. | Promote All/Saved/My listings to explicit views; use visible save feedback. Native applications and alerts require separate capabilities. |
| [Ekşi Sözlük](https://eksisozluk.com/) | Retrieved main content groups entries under linked subject headings. Browser inspection stopped at a Cloudflare challenge. Current navigation geometry and ranking behavior were not verified; user entries about algorithms are not product documentation. | Explore subject-led discussion discovery as an optional product extension. Do not present a proposed topic system as already implemented. |
| [Existing X research](../design/2026-10-01-x-feature-ux-research.md), [current timeline implementation](../../src/components/timeline-list.tsx) | Earlier X research is a historical reference. Current local source and browser fixtures establish how social-web renders attribution today. No new signed-in X audit was performed. | Correct the attribution hierarchy within the existing social UI. |
| [W3C WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/#target-size-minimum) | WCAG 2.2 AA minimum pointer targets are 24×24 CSS px with specified exceptions; enhanced targets use 44×44. | Adopt 44 px targets for primary standalone controls as our product choice. Do not call this the universal AA minimum. |

Search used `bx`; Ekşi main content used `firecrawl` after search returned unrelated historical entries. Browser inspection used isolated named `agent-browser` sessions. No sign-in, application submission, save, message, account change or external publication was performed.

## Baseline UI audit

The actual application components and stylesheet imports were served by a temporary Vite configuration, with synthetic profiles/jobs/posts/articles and a local authentication stub. The fixture rejected non-GET API requests. Environment files and live account data were not used. Measurements are browser CSS pixels, relative to the viewport at scroll position zero. They establish layout, not backend behavior.

Checked Jobs at widths 320, 375, 620, 621, 700, 701, 768, 1024, 1050, 1051, 1067, 1068, 1279, 1280 and 1440. Additional height checks used 1440×480, 768×480 and 320×340. The document did not overflow horizontally at the inspected widths. Sidebar account controls remained inside the 480 px high desktop/tablet viewport.

At 375×667, also inspected Jobs create/detail, Articles list/create/detail, Events list, Events create without membership, Drafts empty state, Settings, Analytics, Lists empty state and Saved Searches empty state. Populated event editing, failure interactions, real device keyboards and live authenticated flows remain unverified.

| Viewport / surface | Observed measurement | Implication |
| --- | --- | --- |
| Jobs, 1440×900 | Main column 600 px; content 550 px; filters 118 px high; first card starts at y=242 | Desktop uses the generic feed column and a dense two-row filter form. |
| Jobs, 375×667 | Content 347 px; filters 336 px high; first card starts at y=561 | The bottom navigation obscures most of the first visible card before any scroll. |
| Jobs, 320×600 | First card starts at y=580 | No useful first-result content is visible above the bottom navigation. |
| Jobs, width 620 → 621 | Filter height 336 → 118 px; first-card y=505 → 296 | A one-pixel viewport change causes an abrupt vertical layout change. |
| Jobs, width 1067 → 1068 | Main column 629 → 600 px | The temporary shell breakpoint patch makes the main column wider just before the regular layout resumes. |
| Jobs/Articles/Events creation links | Header links are 40 px high; ordinary feature buttons are 44 px | A selector targets buttons but misses anchors rendered through `Button asChild`. |
| Jobs filters | Inputs 46 px; filter button 44 px | Controls do not share a height or typography contract. |
| Jobs create, 375×667 | Text inputs 43 px; selects 41 px; datetime input 45 px | Form controls inherit different font/line-height and native metrics. |
| Jobs detail, synthetic owner view | Actions start at y=710 with a short description | Apply/Save appear after the entire description; owner operations share the same action group. |
| Following timeline, 1440×900 | Attribution starts at y=240; author heading at y=273 | Attribution sits outside the card's padded area, followed by a separate card gap. |
| Following timeline | Attribution text starts 4 px to the right of the author on desktop and 2 px to the left on mobile | Separate hardcoded padding values drift from the author column. |

Evidence sources: [Jobs page](../../src/pages/jobs.tsx), [shared feature CSS](../../src/components/medium-features.css), [shell](../../src/router.tsx), [base styles](../../src/styles.css), [responsive overrides](../../src/components/responsive.css), [PostCard](../../src/ui.tsx), [timeline wrapper](../../src/components/timeline-list.tsx), [repost CSS](../../src/components/reposts.css), [Button](../../src/components/ui/button.tsx). The attribution text offsets above include the icon and gap, rather than measuring the full-width wrapper's left edge.

Scoped visual evidence: [Jobs desktop](../screenshots/2026-10-03-ui-audit/jobs-desktop.png) and [repost entries](../screenshots/2026-10-03-ui-audit/reposts-desktop.png). Both images contain synthetic local data and record the baseline UI, not the proposed design or a live account.

### Prioritized findings

P0 = current layout/interaction correction; P1 = existing workflow improvement; P2 = optional product extension.

| ID | Priority | Finding | Required change |
| --- | --- | --- | --- |
| GEO-01 | P0 | Feature controls use 40/41/43/44/45/46 px heights | One control geometry contract covering buttons, anchor buttons, inputs and selects. |
| GEO-02 | P0 | Page headings, cards and editor spacing differ from existing social chrome | Shared page header, spacing and overflow rules with scoped page variants. |
| GEO-03 | P0 | Shell column size reverses around 1067/1068 px | Replace the narrow patch with bounded grid columns and explicit layout modes. |
| JOB-01 | P0 | Five stacked mobile fields plus submit hide results | Compact query/location search; refinements in a bounded mobile panel. |
| JOB-02 | P1 | All/Saved/My listings are buried in the same filter select | Visible navigation views with URL state and appropriate empty states. |
| JOB-03 | P1 | Active filters have no summary or clear action | Removable active-filter chips and Clear all. |
| JOB-04 | P1 | Listing cards provide only title navigation and passive saved text | Scannable hierarchy, independent Save control, full destination semantics and pending/error feedback. |
| JOB-05 | P0 | Apply is below the description; owner actions compete with applicant actions | Applicant actions near the title; owner management in a separate group. |
| JOB-06 | P1 | Short descriptions and long descriptions have the same undifferentiated detail layout | Summary block, readable description, publisher identity and explicit application destination. |
| JOB-07 | P1 | Preview omits mode/type/deadline and has different markup from details | Shared job preview/detail presentation and grouped editor sections. |
| JOB-08 | P1 | Expiry is calculated in detail only; list badges show stored status | Derive applicant availability consistently in cards and details. |
| SOC-01 | P0 | Repost attribution is a sibling outside PostCard | Put the attribution inside the card above the original author, using its author column. |
| SOC-02 | P1 | Generic right rail remains community discovery on every feature page | Show page-relevant guidance; use the available width for wide job browsing. |
| STATE-01 | P1 | Feature lists lack the existing content-only loading pattern | Preserve search/navigation while refreshing results; distinguish pending, empty and error states. |
| TOOLS-01 | P1 | Articles, Events, Drafts, Settings and Analytics share coarse generic presentation | Apply the common system, then tune each surface for its reading or editing task. |
| DISC-01 | P2 | Discussions are discoverable primarily through posts and communities | Define optional subject-led discovery after the core UI corrections. |

The table combines measured defects with source-backed workflow gaps. Items proposing new controls/layouts are design requirements; they are not claims that a competitor has exactly that implementation.

## Shared geometry and visual contract

- Use a spacing scale of 4, 8, 12, 16, 20, 24 and 32 px. Prefer 16 px horizontal mobile page padding and 20–24 px desktop padding. Use shared tokens rather than additional late stylesheet overrides.
- Standalone primary/secondary controls and segmented-view hit areas have a minimum 44 px height; icon controls have 44×44 px hit areas. Button links follow the same rule. Text fields/selects use the same 44 px minimum with explicit font, line-height, padding and `box-sizing`; wrapping/localized controls may grow.
- Inputs retain at least 16 px text on mobile. Labels use 13–14 px and remain visible outside placeholder text. Button text uses an explicit shared size rather than relying on undefined Tailwind size utilities.
- Page titles use 20/26 px on mobile and 22/28 px on desktop; body text uses 15–16 px with appropriate reading line-height; metadata uses 12–13 px. Job/article detail titles may grow and wrap naturally. These are initial design targets to confirm visually.
- Lists/cards use content-driven height. Job cards clamp list titles to two lines, preserve the full accessible title, and show the complete title on detail. Company/location may wrap; controls never shrink under text pressure.
- Use one card border, background and radius treatment consistent with the established pixel UI. Distinguish selection, hover, focus and disabled states; status changes must not depend solely on color.
- Use `min-width: 0` on grid/flex text regions, bounded overlay widths and deliberate long-word wrapping. Avoid repairing overflow by clipping the whole document.
- Keep the social main column at a maximum 600 px. When the right rail appears, its width/gap must fit without making the social column temporarily exceed that cap.
- Keep the mobile topbar, page header, content and bottom navigation offsets in shared variables. Sticky controls include safe-area insets and reserve their occupied space. Focused elements and final content remain reachable above fixed controls.
- Short desktop heights scroll navigation within the available sidebar space while keeping account controls reachable. Preserve the behavior observed at 480 px height.

## Visual UI renewal

The owner clarified that this pass must include visual redesign, in addition to geometry and workflow fixes. The [baseline job screenshot](../screenshots/2026-10-03-ui-audit/jobs-desktop.png) shows a plain heading, equally prominent filter boxes and text-only bordered cards. The [feature stylesheet](../../src/components/medium-features.css) applies much of the same presentation to jobs, articles, events and tools. Replace that generic presentation with task-specific visual compositions using the existing brand tokens and icon library.

### Art direction

Use the dark canvas, restrained blue accent, crisp pixel icons and small pixel identity elements already established in the social feed. Establish three visible layers: page canvas, grouped controls/supporting surfaces, and selected/interactive content. Avoid giving every metadata item, paragraph and card its own competing border. Let title size, spacing, text tone and alignment establish hierarchy.

Use one filled treatment for the primary action, an outlined treatment for secondary actions, and quiet icon/text actions for utilities. Apply the existing brand accent to current-view indicators, selection and focus consistently. Reserve semantic colors for availability, success and destructive actions; pair them with text/icons. Job names and descriptions remain easy-to-read text rather than decorative pixel typography.

### Screen-by-screen visual changes

| Surface | Visual renewal | Visual acceptance |
| --- | --- | --- |
| Jobs header | Compact page title/action row; a distinct view-navigation strip; search/refinements in a grouped supporting surface | Title, navigation and search read as three levels, with one clear primary action. |
| Job cards | Leading 40 px job/company fallback tile, central text hierarchy, trailing Save target; role in 17–18 px semibold, company in 14 px, secondary metadata in 12–13 px | Role is the first scanning anchor. Long titles/company names wrap without pushing Save out of alignment. Cards share padding and metadata placement, with content-driven height. |
| Job working conditions | Quiet mode/type labels or compact chips separated from the availability badge; use existing Pixelarticons where they add meaning | Remote/hybrid/onsite, employment type and open/closed/expired state are visually distinguishable without turning the whole card into badges. |
| Selected job | Subtle surface change plus a clear edge/outline treatment, separate hover and keyboard-focus appearance | Selected, hovered, focused and saved are distinguishable states. Save does not look like card selection. |
| Job detail | Summary block with identity tile, wrapping role title, company/conditions, applicant action row and destination note; a clear transition into readable description | The first viewport communicates role, company, availability and primary action. Management controls do not dominate the summary. |
| Job/article editors | Section headings, short supporting text, consistent fields and a distinct preview surface; align Save/Preview/Cancel by action importance | The editor reads as grouped steps rather than an uninterrupted field stack. Preview resembles the published surface. |
| Repost/feed metadata | Compact attribution inside the card, aligned author/community/content columns, quiet context labels and a consistent action baseline | Repost context belongs visually to the following post, and long names leave author/actions legible. |
| Articles library/detail | Reading-oriented title/summary/byline hierarchy; quieter list cards; detail text constrained to a comfortable measure with paragraph spacing | Articles look like reading content, and retain a recognizable shared page header. |
| Events | Date/day tile, title/community hierarchy, local time/mode details, RSVP action and explicit state treatment | Dates are quickly scannable; cancelled/past events do not look like currently available events. |
| Drafts and private libraries | Context/type icon, compact excerpt, timestamp, aligned Resume/Open action, secondary management controls | Saved items are scan-friendly and their main action stays in a predictable position. |
| Settings | Visually grouped preference sections with concise descriptions, aligned labels and a clear save-feedback area | Settings read as preferences with one Save action; optional explanatory text does not compete with labels. |
| Analytics | Consistent metric label/value composition, clear filter grouping, reduced prominence for methodological notes | Values are easy to compare across cards; the date scope is evident before reading long explanations. |
| Empty/loading/error states | Reuse the established small pixel illustrations and shared state surfaces; adapt title, description and action to the task | A state fits its content region without replacing the page hierarchy or creating a large decorative void. |
| Feature right rail | Page-relevant supporting content with a quiet heading and compact rows; Jobs wide mode gives this space to details | Supporting content has visibly lower emphasis than the main task. |

Sizes above are proposed product targets, subject to the shared geometry and real-content checks. They are not competitor measurements. Fallback tiles use bundled assets or letters; new logo generation and company-logo fetching are not required by this UI slice.

### Visual deliverables

For each implemented slice, capture scoped before/after views of the real components using the same local synthetic dataset. The first review set includes Jobs list and selected detail at 1440 px, Jobs list/detail at 375 px, a 320 px long-title card, and a repost followed by an ordinary post. Include selected/saved/closed states where relevant. Review title hierarchy, alignment, whitespace, border density, typography and action emphasis alongside the interaction criteria.

Use the Jobs and repost surfaces as the first visual reference implementation, then apply the shared choices to the other pages. UI renewal is a required part of P0/P1 completion; a spacing-only patch does not complete this section.

## Jobs: discovery, reading and publishing

### List and filters

Use a compact page header followed by `Tüm ilanlar`, `Kaydettiklerim`, `İlanlarım`. Treat these as navigation views with current-state semantics; use ARIA tabs only if implementing the complete tab keyboard pattern. View state remains in `filter=all|saved|mine`.

The primary search contains role/company query and location, followed by one `Ara` action. On small screens, keep refinements collapsed behind `Filtreler`, showing the applied refinement count. Work mode and employment type belong to refinements; the selected view is not counted as a refinement. A clear action removes query/location/refinements without silently switching the selected view.

Use an explicit submit flow. Editing panel controls changes draft selections; `Uygula` commits the URL once and closes the panel, while `Vazgeç`/Escape dismiss without applying. Applied chips remove individual filters and reset cursor/history. Restore trigger focus after dismissal. Bound the panel to available viewport height with its own scroll area and reachable footer.

At 375×667 with default filters, target the first result at y≤360, leaving useful card content above the bottom navigation. At 320×600, at least the first role title and company must be visible without scrolling. These are acceptance targets for social-web, not competitor measurements. Small landscape/keyboard viewports must remain usable through scrolling rather than squeezing all content above the fold.

Show active filters above results. Do not show a made-up total: `ResourcePage<Job>` currently provides items and nextCursor, not a total. Keep current server order and cursor pagination; offer sorting only after its API contract exists. Reset cursor/history on query, refinement or view changes and preserve state through Back/Forward.

### Card and details

Card order: role title → company → location → mode/type → availability/deadline/date metadata. Give Save a stable independent hit area, pressed state, optimistic feedback with rollback or explicit pending handling, and a local error. Avoid an interactive element nested inside another interactive element.

Use a bundled job/company icon or a letter fallback; the current model has no company logo or verified-company identity. Display the member publisher separately from the company name. Do not imply the publisher is an authorized recruiter or that a company profile exists.

Detail order: back to results → role/company → working conditions/status/deadline → Apply/Save/Share → description → publisher and secondary information. Keep `Dış sitede başvur` explicit and show the destination domain. A click is not a submitted application. Preserve HTTPS URL checks and closed/expired/unavailable handling.

Owner controls use a separate `İlanı yönet` area for Edit, Publish, Close and Delete, with state-appropriate actions and an explicitly destructive Delete treatment. Applicant Save/Apply must remain easy to recognize in an owner view.

For mobile, keep Apply/Save near the summary. If adding a bottom action dock for long descriptions, place it above the five-destination navigation, reserve content space, account for safe areas, and avoid duplicate keyboard focus stops. Validate it with an open keyboard before release.

Availability is derived from status and deadline on both cards and detail. Drafts are private, closed listings say closed, and expired published listings say expired. Refresh time-dependent display when the page becomes active. Do not equate createdAt with publication time: the [current job schema](../../server/db/schema.ts) has createdAt/updatedAt but no publishedAt.

### Wide jobs workspace

After the single-column corrections, introduce a Jobs-specific workspace at viewport widths ≥1051 px: retain the global navigation, replace the generic discovery rail with space for results/detail, and cap the shell at its current 1255 px maximum. Use approximately 300–340 px for results, a 20–24 px gap, and the remaining space for readable details. At smaller widths, navigate list → detail as separate screens in the existing main column.

The selected job keeps the canonical `/jobs/:id` URL; opening a deep link loads its details without requiring previous list navigation. Preserve list filters/cursor and return position when navigating back. A missing or unauthorized selected job has a clear return-to-results action. Selection does not clear the results or show a full-shell spinner. Prefer the existing query/cache and route layout patterns; do not create a second resource API merely for this layout.

Editor routes use a focused form rather than a cramped list/detail pane. Apply wide-mode styling only to Jobs routes, with explicit route state in the shell. This mode switch is intentional; the unrelated social breakpoint width reversal is not.

### Editor and preview

Group fields into role/company, working conditions, description, and application/deadline. Explain optional fields and external application behavior next to the relevant input. Reuse the existing schema limits and version checks from the [Jobs resource contract](2026-10-01-medium-features.md#1-jobs-with-external-applications).

Show field errors beside the input and a short summary when needed; focus the first invalid field. Preview uses the same summary, conditions, deadline and description presentation as detail. Explain the draft → preview → publish flow and retain form values on errors/conflicts/navigation cancellation. Use one clear primary action, and distinguish Save draft from Publish.

### Job/social connection

In P1, add Copy link/native share for published accessible jobs by generalizing the [existing share component](../../src/components/share-menu.tsx) to accept a destination URL/title. Shared URLs still require the product's normal membership/authentication. Share actions do not publish a timeline post or expose private drafts.

A later P2 slice can provide `Akışta paylaş` with a reviewable composer draft. Structured in-feed job cards require an explicit resource-reference and visibility contract; the current Post type has no job reference. Closing/deleting a job must update its shared representation, and old shares must never advertise an unavailable Apply action. Research this separately before schema work.

## Social attribution

Make repost context part of PostCard or a single shared card layout, with an optional actor supplied by TimelineList. Render the context above the **original author's name**, not below content or beside engagement actions.

Use one author-column geometry for attribution, community context, author metadata and content. Place the repost icon immediately before the attribution text, with the text's left edge aligned to the original author's name. Avoid independent 48/42 px padding guesses. Keep a compact 12/16 px muted label and a 4–6 px gap to the author row; the entire entry owns its top padding and bottom separator.

Reposter name remains a profile link; original author/avatar remain original-author links; the repost timestamp must not replace the source-post time. The card detail hit area must not swallow attribution/menu/action clicks. Long reposter names truncate within the available column with a full accessible label. A community repost uses repost context → community context → author/content and preserves membership restrictions.

Render no empty context row for ordinary posts. Dismissing a card also removes its repost context. Apply the same presentation wherever TimelineList is used, including Following, profile timelines and account Lists. Keep `Yeniden paylaş` as the action and `{name} yeniden paylaştı` as attribution; they serve different interactions.

## Other new surfaces

| Surface | P1 improvements | Data/behavior boundary |
| --- | --- | --- |
| Articles | Shared header; readable list summaries; clear Published/My drafts views; publisher/time row; constrained reading measure; paragraph rhythm; management separated from reading | Current content is plain text. Formatting tools, covers and comments require separate capability work. |
| Events | Compact Upcoming/Past and community filtering; date/time-first cards; clear cancelled/past states; join/RSVP feedback; visible meeting domain | Respect joined-community visibility. A user with no joined communities gets a useful community-discovery action. |
| Drafts | Context badge, bounded excerpt, saved time and Resume primary action; unavailable-target explanation; destructive action secondary | Keep personal/community/reply context distinct; job/article drafts remain in their own libraries. |
| Settings | Group existing preferences; consistent labels/control height; clear saved/error/dirty state; large checkbox label target | Only show settings that affect the product today. |
| Analytics | Explain date scope near the filter; legible metric cards; responsive grid; concise explanation near relevant metrics | No invented impressions, growth, application counts or recommendation scores. |
| Lists / Saved Searches / Bookmarks | Align page chrome and empty states; distinguish private library actions from discovery; bounded pagination | Preserve cursor/visibility and existing saved-search query/tab contracts. |
| Navigation / right rail | Clear current section; Jobs/Articles remain easy to reach through mobile More; relevant guidance on feature pages | Keep the current five mobile destinations during P0/P1; changing the primary navigation is a separate product decision. |

Source surfaces: [page files](../../src/pages), [navigation config](../../src/components/navigation-config.ts), [current feature contracts](2026-10-01-medium-features.md), [shared types](../../shared/types.ts).

## Optional subject-led discussions

Start by improving discovery of existing community discussions: show a concise subject/excerpt, community, author, reply count and latest known activity when that data exists. Use a reading-oriented thread detail layout with clear replies and reply action. Label community discovery as communities, not topic indexing.

A true Ekşi-inspired subject system is a P2 proposal. It needs a separate decision on canonical titles, duplicate handling, topic/community relationship, entry ordering, search, follow/save semantics and moderation. Do not silently convert article titles or personal post text into canonical topics, promise a trending algorithm, or add popularity numbers without recorded data. The verified Ekşi reference supports subject-led reading, not a claim about its current ranking algorithm.

## Loading, empty, error and interaction requirements

- Preserve the page header, applied query and view controls during a result refresh. Mark only the results busy, disable duplicate traversal and show the existing delayed content indicator or stable placeholders in that region.
- Distinguish an empty board, no filter matches, no saved jobs and no owned listings. Offer a relevant action: clear filters, explore jobs or create a listing.
- A search/load failure keeps the committed filters and gives Retry. A mutation failure keeps entered content and restores previous Save/RSVP/repost state as applicable.
- Back/Forward restore committed search state. Return from detail should retain the list position. In wide mode, stale detail responses must not replace a newer selection.
- Visible field labels, semantic links/buttons, current-view state, focus rings, Escape dismissal and focus restoration are required. Screen-reader feedback covers saving, failed saves, loading results and unavailable resources.
- Check contrast on actual surfaces, text scaling, keyboard navigation, 320 CSS px reflow, reduced motion, long names/URLs and target size. Do not infer accessibility conformance from dimensions alone.

## Implementation order and acceptance

1. **P0 shared geometry + repost:** introduce shared tokens/page chrome and action styling, normalize control targets including anchor buttons, correct the social shell cap and visually integrate repost attribution into the card. Accept when text aligns within 1 CSS px at 320/375/768/1440 px, context belongs to its card, controls follow the geometry contract and existing navigation remains reachable.
2. **P0 Jobs mobile + detail:** redesign the header/search composition, card hierarchy and detail summary; shorten search/refinements and move applicant actions above description. Accept the initial-result visibility targets, bounded panel/focus behavior, long-title wrapping, closed/expired states and owner/applicant action separation, with scoped before/after visual evidence.
3. **P1 Jobs workflow:** explicit views/chips, independent Save, consistent preview/editor, resource sharing, content-only loading, then the wide workspace. Accept URL/Back behavior, selection failures, save rollback and canonical deep links without duplicate requests or shell reset.
4. **P1 other pages:** apply common geometry, task-specific reading/editing hierarchy and state handling to Articles, Events, Drafts, Settings, Analytics and libraries.
5. **P2 product exploration:** evaluate subject indexing and structured job-to-feed sharing with explicit data/visibility contracts before implementation.

Affected implementation areas: `src/router.tsx`, `src/ui.tsx`, `src/components/timeline-list.tsx`, `src/components/repost-action.tsx`, shared feature/page/button CSS/components, `src/pages/jobs.tsx`, and the other feature page files. Prefer shared components plus scoped Jobs/reading/editor variants; retire conflicting rules rather than appending another broad override file. P0/P1 layout work should normally use current APIs; any schema/API change must be called out separately.

Local implementation verification is recorded in the [implementation review](2026-10-03-ui-implementation-review.md), including narrow layouts, breakpoint transitions, short filter dialogs, selected Jobs, synthetic mutation states, typecheck, production source build and existing tests. Typecheck, production source build and whitespace checks passed. A real mobile keyboard, live authentication/database flows, real pagination and native sharing remain unverified. These checks do not establish full accessibility conformance.

### Implementation status

P0/P1 UI work is implemented using the existing resource APIs and plain-text contracts. Shared feature headers, sections, empty states and 44 px controls now support task-specific Jobs, Articles, Events and library presentations. Jobs owns a wide list/detail workspace; the social feed retains its 600 px cap. Feature-specific supporting content replaces generic discovery guidance on relevant pages.

Repost context is part of PostCard and shares the source author column. Jobs has explicit URL views, applied filters, a bounded refinement dialog, separate applicant/owner actions, shared save state, grouped editor/preview and published-resource sharing. Articles and Events preserve list search context through their detail/editor flows. Drafts, Settings, Analytics, Lists, Saved Searches and Bookmarks use the renewed feature geometry and state presentation.

The [implementation review](2026-10-03-ui-implementation-review.md) separates measured results from implemented but unverified behavior. No database schema or remote service change was made. P2 subject indexing and structured job-to-feed sharing remain undecided and unimplemented.

### Completion tracking

- [x] Inspect current feature source and stylesheet relationships.
- [x] Inspect actual component layout with local synthetic data.
- [x] Research Kariyer.net and LinkedIn; record guest/access limitations.
- [x] Evaluate subject-led discussion direction without assuming a topic backend.
- [x] Record priorities, geometry targets, workflow contracts and acceptance criteria.
- [x] Define screen-specific visual renewal and visual review deliverables.
- [x] Implement and locally verify P0 shared geometry/repost; see review limitations.
- [x] Implement and locally verify P0 Jobs mobile/detail; see review limitations.
- [x] Implement and locally verify P1 Jobs workflow/workspace; see review limitations.
- [x] Implement and locally verify P1 other new surfaces; see review limitations.
- [ ] Decide P2 topic and structured-sharing scope.

The initial research pass produced the design and baseline evidence. Application UI source now implements P0/P1. Database schema and remote services were not changed; no commit or push was performed during this implementation pass.
