import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Icon } from "./icon";
import { isNavigationDestinationActive, primaryNavigation, secondaryNavigation } from "./navigation-config";
import "./more-navigation.css";

const compactDestinations = primaryNavigation.filter(item => item.to === "/jobs" || item.to === "/articles");

export function MoreNavigation({ compact = false }: { compact?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const router = useRouter();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const availableSecondary = secondaryNavigation.filter(item => item.to in router.routesByPath);
  const availableCompact = compactDestinations.filter(item => item.to in router.routesByPath);
  const active = (to: string) => isNavigationDestinationActive(pathname, to);
  function close(restoreFocus = false) {
    if (menu.current) menu.current.open = false;
    setOpen(false);
    if (restoreFocus) menu.current?.querySelector("summary")?.focus();
  }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = menu.current?.querySelector("summary")?.getBoundingClientRect();
      if (!anchor || !panel.current) return;
      const width = Math.min(248, window.innerWidth - 24);
      const maxHeight = Math.min(320, window.innerHeight * 0.65, window.innerHeight - 24);
      const height = Math.min(panel.current.scrollHeight, maxHeight);
      const collapsed = !compact && window.innerWidth < 1280;
      const preferredLeft = compact ? anchor.right - width : collapsed ? anchor.right + 8 : anchor.left;
      const preferredTop = compact ? anchor.bottom + 6 : collapsed ? anchor.top : anchor.top - height - 8;
      setPosition({ left: Math.max(12, Math.min(preferredLeft, window.innerWidth - width - 12)), top: Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12)), width, maxHeight });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, compact]);
  useEffect(() => { close(); }, [pathname]);
  return <details
    ref={menu}
    className={`more-navigation${compact ? " is-compact" : ""}${[...availableSecondary, ...(compact ? availableCompact : [])].some(item => active(item.to)) ? " is-active" : ""}`}
    onToggle={event => setOpen(event.currentTarget.open)}
    onBlur={event => {
      // A pointer click can blur the summary without focusing its destination.
      // Keep the link mounted until click; outside pointer events still dismiss.
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close();
    }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close(true); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (menu.current) menu.current.open = true;
      const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Home") items[0]?.focus();
      else if (event.key === "End") items.at(-1)?.focus();
      else items[index < 0 ? event.key === "ArrowDown" ? 0 : items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    }}
  >
    <summary aria-label="Daha fazla" aria-haspopup="menu" aria-expanded={open}>
      <Icon name="menu" size={compact ? 22 : 27} />
      <span className="more-navigation-label">Daha fazla</span>
    </summary>
    <div ref={panel} style={position} className="more-navigation-items" role="menu" aria-label="Diğer araçlar">
      {compact && <>
        <p className="menu-section-label">Gezinme</p>
        {availableCompact.map(item => <Link key={item.to} to={item.to} role="menuitem" aria-current={active(item.to) ? "page" : undefined} onClick={() => close()}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}
      </>}
      <p className="menu-section-label">Araçlar</p>
      {availableSecondary.map(item => <Link key={item.to} to={item.to} role="menuitem" aria-current={active(item.to) ? "page" : undefined} onClick={() => close()}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}
    </div>
  </details>;
}
