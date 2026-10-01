# Navigation layout

Date: 2026-10-01
Status: Local UI implementation and route wiring complete; integration browser checks passed.

## Structure

- The desktop primary navigation keeps Home, Explore, Notifications, Communities and Profile, then promotes Jobs and Articles as direct destinations.
- More remains a private tools menu for Lists, Bookmarks, Saved Searches, Drafts, Events, Settings and Analytics.
- The compact mobile More menu also lists Jobs and Articles above the private tools so both promoted destinations remain reachable from a phone.
- The five existing mobile bottom destinations remain unchanged.
- `navigation-config.ts` is the shared source for the primary and secondary destination labels, paths and icons. The desktop sidebar component consumes primary destinations; More consumes secondary destinations and adds Jobs/Articles only in its compact mode.

## Interaction and layout

- Active destinations use the existing gray sidebar state and include their detail routes.
- Menu links have 44px minimum touch targets. Arrow keys, Home and End move through menu items; Escape closes and restores focus. Pointer dismissal and path changes close the menu.
- The More panel is scrollable and placed inside viewport bounds. On compact screens it opens below its trigger; on a collapsed desktop rail it opens beside the trigger.
- At widths below 1280px, desktop labels collapse while icons remain available. Short desktop viewports scroll only the navigation, preserving the account controls at the bottom. The sidebar stacking context keeps More above main content.

## Integration

`router.tsx` renders `SidebarNavigation` inside `<nav className="x-nav" aria-label="Ana menü">`, uses the shared five-item mobile configuration, and retains compact More in the mobile top bar.

Browser checks at 1440×600 and 1024×600 verified seven primary destinations, gray active state, account controls inside the viewport, and a clickable bounded popup. A simulated null-relatedTarget blur still navigated to Settings. At 320×600 compact More contained nine destinations, scrolled to its last 44px item and opened Analytics; the five-link mobile bar remained unchanged. Additional 375px and 768px checks found no horizontal overflow.
