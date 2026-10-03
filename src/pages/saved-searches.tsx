import { isRedirect, Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import type { SavedSearch, SavedSearchesPage } from "../../shared/types";
import { FeatureEmpty, FeatureHeader } from "../components/feature-presentation";
import { Icon } from "../components/icon";
import "../components/saved-searches.css";

type SavedSearchesData = SavedSearchesPage & { loadError?: string };
type SavedSearchRoute = { cursor?: string; cursorHistory?: string[] };

export function SavedSearchesPageView() {
  const data = useLoaderData({ strict: false }) as SavedSearchesData;
  const search = useSearch({ strict: false }) as SavedSearchRoute;
  const navigate = useNavigate();
  const router = useRouter();
  const loading = useContentLoading();
  const showLoading = useDelayedLoading(loading);
  const cursor = search.cursor || "";
  const history = Array.isArray(search.cursorHistory) ? search.cursorHistory.filter((item): item is string => typeof item === "string").slice(-20) : [];
  const [rows, setRows] = useState(data.searches);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const pendingIdsRef = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setRows(data.searches);
  }, [data.searches]);

  function goTo(nextCursor: string, cursorHistory: string[]) {
    void navigate({ to: "/saved-searches", search: { cursor: nextCursor, cursorHistory } as never });
  }

  async function remove(item: SavedSearch) {
    if (pendingIdsRef.current.has(item.id)) return;
    const confirmed = window.confirm(`“${item.query}” aramasını kaydedilenlerden kaldırmak istiyor musun?`);
    if (!confirmed) return;
    setError("");
    pendingIdsRef.current.add(item.id);
    setPendingIds(current => new Set(current).add(item.id));
    try {
      await api<{ success: true }>(`/saved-searches/${encodeURIComponent(item.id)}`, "DELETE");
      setRows(current => current.filter(row => row.id !== item.id));
      try {
        await router.invalidate();
      } catch {
        setError("Arama kaldırıldı ancak liste yenilenemedi. Sayfayı yenileyebilirsin.");
      }
    } catch (cause) {
      if (isRedirect(cause)) {
        await navigate({ to: "/sign-in" });
        return;
      }
      setError(cause instanceof Error && "status" in cause && cause.status === 403
        ? "Bu aramayı kaldırma iznin yok. Liste değişmedi."
        : "Arama kaldırılamadı. Tekrar deneyebilirsin.");
    } finally {
      pendingIdsRef.current.delete(item.id);
      setPendingIds(current => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function retryLoad() {
    setRetrying(true);
    try { await router.invalidate(); } finally { setRetrying(false); }
  }

  return <section className="feature-page saved-searches-page">
    <FeatureHeader className="saved-searches-heading" title="Kaydedilen aramalar" eyebrow="ÖZEL KÜTÜPHANE" description="Aramalarını aynı görünümde yeniden aç. Yalnızca sen görebilirsin." />
    {error && <p className="saved-searches-error" role="alert">{error}</p>}
    <div className="feature-results" aria-busy={loading}>
    {showLoading ? <LoadingSpinner label="Kaydedilen aramalar yükleniyor" /> : data.loadError ? <div className="saved-searches-load-error" role="alert">
      <p>{data.loadError}</p>
      <Button variant="outline" disabled={retrying || loading} onClick={() => void retryLoad()}>{retrying ? "Yeniden deneniyor…" : "Tekrar dene"}</Button>
    </div> : rows.length ? <ul className="saved-searches-list" aria-label="Kaydedilen aramalar">
      {rows.map(item => <li className="saved-search-row" key={item.id}>
        <span className="saved-search-icon"><Icon name="search" size={20}/></span>
        <div className="saved-search-content">
          <Link className="saved-search-query" to="/explore" search={{ q: item.query, tab: item.tab } as never}>{item.query}</Link>
          <span className="saved-search-tab">{item.tab === "posts" ? "Gönderiler" : item.tab === "people" ? "Kişiler" : "Topluluklar"}</span>
        </div>
        <Button className="saved-search-remove feature-danger-action" variant="ghost" disabled={loading || pendingIds.has(item.id)} onClick={() => void remove(item)} aria-label={`“${item.query}” aramasını kaldır`}>
          {pendingIds.has(item.id) ? "Kaldırılıyor…" : "Kaldır"}
        </Button>
      </li>)}
    </ul> : !cursor && !data.nextCursor ? <FeatureEmpty className="saved-searches-empty" title="Henüz kaydedilmiş araman yok" description="Keşfet’te bir arama yapıp Kaydet’i seçtiğinde burada bulabilirsin." icon={<Icon name="search" size={24}/>} action={<Button variant="outline" asChild><Link to="/explore">Keşfet’e git</Link></Button>}/> : <FeatureEmpty className="saved-searches-empty" title="Bu sayfada arama yok" description="Diğer sayfalara geçebilir veya ilk sayfaya dönebilirsin." icon={<Icon name="search" size={24}/>} action={<Button variant="outline" disabled={loading} onClick={() => goTo("", [])}>İlk sayfaya dön</Button>}/>}
    </div>
    {!data.loadError && (cursor || data.nextCursor) && <nav className="saved-searches-pagination" aria-label="Kaydedilen arama sayfaları">
      {history.length ? <Button variant="outline" disabled={loading} onClick={() => goTo(history.at(-1) || "", history.slice(0, -1))}>Önceki</Button> : cursor ? <Button variant="outline" disabled={loading} onClick={() => goTo("", [])}>İlk sayfa</Button> : <span />}
      <Button variant="outline" disabled={loading || !data.nextCursor} onClick={() => data.nextCursor && goTo(data.nextCursor, [...history, cursor].slice(-20))}>Sonraki</Button>
    </nav>}
  </section>;
}

export async function loadSavedSearches(cursor: string): Promise<SavedSearchesData> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  try {
    return await api<SavedSearchesPage>(`/saved-searches${query}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { searches: [], nextCursor: null, loadError: "Kaydedilen aramalar yüklenemedi. Bağlantını kontrol edip tekrar dene." };
  }
}
