# Medium feature execution plan

Design: [Frozen medium scope](../specs/2026-10-01-medium-features.md).
Status: All eight steps complete locally. Coordinator completed final hardening and validation after the implementation/menu agents reached their usage limit. The owner separately authorized remote migrations on 2026-10-02; 006–013 are applied and verified. Git publication is tracked separately in repository history.

Execute vertical slices sequentially, with typed API contracts and migrations reviewed before UI integration. Preserve existing uncommitted work. The original local-only boundary was superseded for migrations by the owner's 2026-10-02 authorization; expensive deferred features remain outside scope.

| Step | Files | Work | Verify / done condition |
| --- | --- | --- | --- |
| 1. Explore pages | server/api.ts, search service/cursor, shared/types.ts, social/router, focused tests | Backward-compatible picker search plus scoped per-tab cursor pages | More than 20 matching rows traverse without gaps; query/tab changes reset; typecheck and affected tests |
| 2. Jobs | Additive migration, schema/service/API/types, jobs page/CSS/routes/icons | Real owner draft/publish/edit/close, private saves, filters and HTTPS application destination | API/direct RLS/version/cursor/state tests; fixture publisher/reader flows |
| 3. Articles | Additive migration, schema/service/API/types, article page/CSS/routes | Durable private text drafts, preview/publish/edit/delete and reader | RLS/version/render/failure tests; fixture author/reader flow |
| 4. Text drafts | Additive migration/service/API/types, composer-draft/composer, drafts page | Explicit durable save/resume/delete; clear only after successful publish | Account/context recovery, missing targets, publish-failure preservation; fixture reload/resume |
| 5. Settings | Private preferences resource, settings page, shell/feed/activity integration | Reduced motion and actual default feed/category preferences | Account isolation, persistence, URL precedence and visible failures |
| 6. Analytics | Owner aggregate service/API, analytics page | Recorded counts with clear definitions | Counts match SQL data/undo/deletion; no foreign-owner access; fixture zero/nonzero |
| 7. Events | Additive migration, schema/service/API/types, event pages/routes | Member-scoped events and RSVP, owner edit/cancel/delete | Direct RLS, current membership, duplicate RSVP, past/cancelled states and time validation; fixture flow |
| 8. Integration | More/router/icons, README, validation report | Register only completed tools, retain five mobile bottom links, reconcile docs | Typecheck/build/full suite/diff; 320/375/768/1024/1440px browser fixture checks |

Report completed steps and migration filenames as they finish. If a design issue appears, resolve it within the frozen minimum slice and record the choice. Expensive features stay deferred; do not silently stop after only the first medium module.
