# UI implementation review

Date: 2026-10-03
Status: P0/P1 implemented; local validation and scoped visual evidence complete.
Spec: [UI and UX improvements](2026-10-03-improvements-spec.md)

## Implemented scope

- Shared feature headers, sections, empty states, control geometry, supporting sidebars and bounded social shell geometry.
- Repost attribution inside PostCard above the original author, aligned text, preserved source timestamp/links, community context ordering, truncation and a 44×44 menu target without expanding the text row.
- Jobs views, applied filters, bounded refinement dialog, renewed cards, prominent applicant actions, separate owner management, shared paired Save state, grouped editor/preview, resource sharing and canonical wide list/detail navigation.
- Articles reading hierarchy, bylines, excerpts, draft/published states, grouped editor/preview and separate owner controls.
- Events date tiles, period/community controls, explicit event and RSVP states, meeting domain, grouped editor and membership empty states.
- Drafts, Settings, Analytics, Lists, Saved Searches and Bookmarks use the shared feature presentation with task-specific content and state feedback.
- Articles/Events carry list view, period, community, cursor and history through detail, editor and return navigation. Clearing an Events community filter preserves the period. Pagination remains mounted and disabled during refresh.
- Small secondary text on reading/event surfaces uses the shared feature muted color. No full WCAG conformance claim follows from this change or the geometry checks.

Current backend schemas, resource contracts, membership visibility and plain-text formats remain the implementation boundary. P2 subject indexing and structured job-to-feed sharing were not implemented.

## Validation environment

Browser checks rendered actual application components with synthetic local API responses and stub authentication. Synthetic Save, RSVP and Settings requests were handled by the local fixture. No `.env` files, live account, live database or external mutations were used.

The production application source was built separately using a scratch Vite configuration with scratch `envDir` and `outDir`; fixture/authentication plugins were excluded from that build. This distinguishes application build validation from fixture behavior validation.

Browser error collection was empty. The temporary Vite server and isolated browser session were closed after review.

No new tests were added. No commit or push was performed.

## Build and existing tests

| Check | Result | Boundary |
| --- | --- | --- |
| Typecheck | Final run exited 0 | Application TypeScript checks. |
| Production application build | Final build exited 0; 300 modules in 1.54 s | Scratch environment/output directories; no fixture plugins. |
| `git diff --check` | Final run exited 0 | Whitespace validation. |
| Existing suite | 160 passed; one test failed because the sandbox blocked a local port bind | This was an environment restriction, not reported as a clean full-suite run. |
| Isolated port-binding test | Passed with approved sandbox escalation | Together with the first run, all 161 existing tests were verified; the full suite was not rerun with escalation. |

## Layout measurements

All measurements below are CSS pixels from the synthetic browser fixture. They describe the inspected states and viewports.

| Surface / viewport | Observed result |
| --- | --- |
| 320 px wide: Jobs, Articles, Events, Drafts, Settings, Analytics, Lists, Saved Searches, Bookmarks | No horizontal document overflow; inspected standalone controls follow the 44 px geometry. |
| Jobs at 620 and 621 px | No horizontal overflow on either side of the former layout transition. |
| Jobs selected detail at 1051 and 1440 px | Canonical detail route renders the wide list/detail workspace. |
| Social shell at 1067 and 1068 px | Main column is 600 px at both widths. |
| Jobs at 375×667 | First card starts at y=257.5, compared with baseline y=561; the initial-result target y≤360 is met. |
| Jobs filter dialog at 320×340 | x=16, y=16, width=288, height=308; footer remains reachable. |
| Repost at 320, 375, 768 and 1440 px | Attribution/author text x delta=0; ordinary repost gap=5; community repost gap=27 with the intervening community row. At 375 px, both text starts are x=64; context height=16; menu target=44×44. |
| Ordinary and community posts beside reposts | Ordinary posts have no empty context row; community reposts keep a separate community context row. |
| Populated Lists and Saved Searches at 320 px | No horizontal overflow; inspected utility controls are 44 px high. |
| Jobs applicant actions at 320 px | Apply, Save and Share share y=417.5 and height=44; Save/Share width=44. |
| Desktop shell at 1440×480 | Account area bottom=468; navigation scroll height=444 with 273 px visible, retaining access through scrolling. |

## Interaction evidence

| Flow | Observed result |
| --- | --- |
| Jobs refinement dismissal | Escape restores trigger focus and preserves the committed work mode. |
| Jobs refinement apply | Choosing remote work applies the expected URL filter. |
| Jobs Save failure | Previous saved state remains intact; error feedback appears. |
| Saved Jobs removal | Unsave removes the card and reaches the relevant empty state. |
| Paired Jobs Save controls | While PUT was pending, both controls had pressed=true and pending=true. After PUT succeeded, before the failed detail reload, both had pressed=true and pending=false. Exactly one PUT was issued. Reopening showed both controls saved. |
| Selected Jobs detail error | Return-to-results link preserves `mode=remote` and `filter=saved`. |
| Closed and expired Jobs | Apply is disabled and has no application href. |
| Wide selected Jobs return | Selecting the second job and returning to results retains list scrollTop=150. |
| Jobs editor invalid application URL | HTTP URL is blocked with an inline error; focus moves to the URL input. |
| Jobs editor save failure | Synthetic 503 response retains all entered values. |
| Jobs editor preview | Includes mode, type, deadline, destination domain and description; focus moves to `job-preview`. |
| Jobs editor cancellation | Return href carries the Mine view, hybrid mode and cursor/history. |
| Delayed Jobs search refresh | Same header DOM remains mounted, query remains Designer, results are busy with the local loading indicator, and the outer shell spinner is absent. |
| Article and Event return context | Article Mine and Event Past/community/cursor/history remain present in navigation hrefs. |
| Settings save failure | Checked preference and dirty state remain; entered state is retained. |
| Settings save success | Dirty state clears and Save becomes disabled. The final action remains reachable by scrolling. |
| Event RSVP success | Action changes to `Katılımı geri al`. |
| Event RSVP failure | Action remains `Katılımı geri al`, prior attending status remains visible and an error alert appears. |

## Visual evidence

Baseline synthetic captures:

- [Jobs desktop before](../screenshots/2026-10-03-ui-audit/jobs-desktop.png)
- [Repost entries before](../screenshots/2026-10-03-ui-audit/reposts-desktop.png)

After captures:

- [Jobs mobile search, 375 px](../screenshots/2026-10-03-ui-audit/jobs-mobile-search-after.png)
- [Jobs mobile card, 375 px](../screenshots/2026-10-03-ui-audit/jobs-mobile-card-after.png)
- [Jobs mobile detail, 375 px](../screenshots/2026-10-03-ui-audit/jobs-mobile-detail-after.png)
- [Jobs long-title card, 320 px](../screenshots/2026-10-03-ui-audit/jobs-320-card-after.png)
- [Jobs desktop search, 1440×1000](../screenshots/2026-10-03-ui-audit/jobs-desktop-search-after.png)
- [Jobs desktop detail, 1440×1000](../screenshots/2026-10-03-ui-audit/jobs-desktop-detail-after.png)
- [Jobs complete workspace, 1440×1400](../screenshots/2026-10-03-ui-audit/jobs-workspace-after.png)
- [Repost entries, 1440×1000](../screenshots/2026-10-03-ui-audit/reposts-desktop-after.png)

The workspace and desktop feed captures were visually inspected without a reported artifact. All images contain synthetic data and do not document a live account.

## Remaining verification limits

- A real mobile keyboard, physical device behavior and live authentication/database flows were not checked.
- Real backend cursor pagination and native share-sheet behavior were not checked.
- No external application submission or remote write was performed.
- Local layout, focus and state checks are not a full WCAG audit or production readiness certification.
