import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function LoadingSpinner({ label = "İçerik yükleniyor" }: { label?: string }) {
  return <div className="content-loading" role="status" aria-live="polite" aria-label={label}><span className="loading-spinner" aria-hidden="true" /><span className="sr-only">{label}</span></div>;
}

export function useContentLoading() {
  const loading = useRouterState({ select: state => state.isLoading });
  return loading;
}

// Keep the committed outlet mounted until the next page is ready. Search-only
// transitions are handled by the content region inside that same page.
export function usePageTransition() {
  return useRouterState({ select: state => state.isLoading && !!state.resolvedLocation && state.location.pathname !== state.resolvedLocation.pathname });
}

export function useDelayedLoading(loading: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!loading) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, [loading]);
  return loading && visible;
}
