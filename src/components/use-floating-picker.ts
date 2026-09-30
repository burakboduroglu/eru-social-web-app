import { useLayoutEffect, type RefObject } from "react";

export function useFloatingPicker(
  open: boolean,
  panelRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;
    let frame = 0;
    const viewport = window.visualViewport;

    function position() {
      if (!panel || !trigger) return;
      const margin = 12, gap = 8;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const minLeft = viewportLeft + margin;
      const minTop = viewportTop + margin;
      const maxRight = viewportLeft + viewportWidth - margin;
      const maxBottom = viewportTop + viewportHeight - margin;
      const width = Math.max(1, Math.min(360, viewportWidth - margin * 2));
      const fullHeight = Math.max(1, viewportHeight - margin * 2);
      const anchor = trigger.getBoundingClientRect();
      const headerHeight = panel.querySelector(".composer-picker-header")?.getBoundingClientRect().height ?? 45;

      // Measure the natural panel at viewport width before deciding which side has room.
      panel.style.width = `${width}px`;
      panel.style.maxHeight = `${fullHeight}px`;
      panel.style.setProperty("--picker-content-max-height", `${Math.max(1, fullHeight - headerHeight - 2)}px`);
      const desiredHeight = panel.getBoundingClientRect().height;
      const above = Math.max(0, Math.min(fullHeight, anchor.top - gap - minTop));
      const below = Math.max(0, Math.min(fullHeight, maxBottom - anchor.bottom - gap));
      const upward = above >= desiredHeight || (below < desiredHeight && above > below);
      const availableHeight = Math.max(1, upward ? above : below);
      panel.style.maxHeight = `${availableHeight}px`;
      panel.style.setProperty("--picker-content-max-height", `${Math.max(1, availableHeight - headerHeight - 2)}px`);
      const height = panel.getBoundingClientRect().height;
      const top = upward ? anchor.top - gap - height : anchor.bottom + gap;
      panel.style.left = `${Math.max(minLeft, Math.min(anchor.left - 8, maxRight - width))}px`;
      panel.style.top = `${Math.max(minTop, Math.min(top, maxBottom - height))}px`;
      panel.dataset.placement = upward ? "top" : "bottom";
      panel.style.visibility = "visible";
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; position(); }); };
    const scroll = (event: Event) => { if (!event.composedPath().includes(panel)) schedule(); };
    position();
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    observer.observe(trigger);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", scroll, true);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", scroll, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [open, panelRef, triggerRef]);
}
