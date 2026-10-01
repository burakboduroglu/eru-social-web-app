import { isRedirect, Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import { NotificationRow, type NotificationKind } from "../components/notification-row";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import type { NotificationPage } from "../../shared/types";
import "../components/activity.css";

type ActivityPageData = NotificationPage & { loadError?: string; effectiveKind?: NotificationKind | "all" };
type ActivitySearch = { kind?: NotificationKind | "all"; cursor?: string; cursorHistory?: string[] };
const tabs: { kind: NonNullable<ActivitySearch["kind"]>; label: string }[] = [
  { kind: "all", label: "Tümü" },
  { kind: "reply", label: "Yanıtlar" },
  { kind: "like", label: "Beğeniler" },
  { kind: "follow", label: "Takipler" },
];

export function ActivityPage() {
  const data = useLoaderData({ strict: false }) as ActivityPageData;
  const search = useSearch({ strict: false }) as ActivitySearch;
  const navigate = useNavigate();
  const router = useRouter();
  const loading = useContentLoading();
  const showLoading = useDelayedLoading(loading);
  const kind = tabs.some(tab => tab.kind === search.kind) ? search.kind! : data.effectiveKind || "all";
  const cursor = search.cursor || "";
  const history = Array.isArray(search.cursorHistory) ? search.cursorHistory.slice(-20) : [];
  const [readOverrides, setReadOverrides] = useState<Set<string>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const pendingRef = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setReadOverrides(current => new Set([...current].filter(id =>
      pendingRef.current.has(id) || data.notifications.some(notification => notification.id === id && !notification.readAt),
    )));
  }, [data]);

  function goTo(nextKind: NonNullable<ActivitySearch["kind"]>, nextCursor: string, cursorHistory: string[]) {
    void navigate({ to: "/notifications", search: { kind: nextKind, cursor: nextCursor, cursorHistory } as never });
  }

  async function markRead(ids: string[]) {
    const requested = [...new Set(ids)].filter(id => {
      const row = data.notifications.find(notification => notification.id === id);
      return row && !row.readAt && !readOverrides.has(id) && !pendingRef.current.has(id);
    }).slice(0, 20);
    if (!requested.length) return;

    setError("");
    for (const id of requested) pendingRef.current.add(id);
    setPendingIds(new Set(pendingRef.current));
    setReadOverrides(current => new Set([...current, ...requested]));
    try {
      await api("/notifications/read", "PATCH", { ids: requested });
      void router.invalidate().catch(() => setError("Okundu durumu kaydedildi ancak bildirim listesi yenilenemedi."));
    } catch {
      setReadOverrides(current => {
        const next = new Set(current);
        for (const id of requested) next.delete(id);
        return next;
      });
      setError("Bildirimler okundu olarak işaretlenemedi. Tekrar dene.");
    } finally {
      for (const id of requested) pendingRef.current.delete(id);
      setPendingIds(new Set(pendingRef.current));
    }
  }

  async function retryLoad() {
    setRetrying(true);
    try { await router.invalidate(); } finally { setRetrying(false); }
  }

  const visibleUnread = data.notifications.filter(notification => !notification.readAt && !readOverrides.has(notification.id));
  const displayedUnreadCount = Math.max(0, data.unreadCount - data.notifications.filter(notification => !notification.readAt && readOverrides.has(notification.id)).length);
  return <section className="activity-page">
    <header className="activity-heading"><h1>Bildirimler</h1><p>Yanıtlar, beğeniler ve yeni takipçiler.</p></header>
    <nav className="activity-tabs" aria-label="Bildirim türü">
      {tabs.map(tab => <Link key={tab.kind} to="/notifications" search={{ kind: tab.kind, cursor: "", cursorHistory: [] } as never} className={kind === tab.kind ? "active" : ""} aria-current={kind === tab.kind ? "page" : undefined}>{tab.label}</Link>)}
    </nav>
    {!data.loadError && <div className="activity-toolbar">
      <span>{displayedUnreadCount > 0 ? `${displayedUnreadCount} okunmamış bildirim` : "Okunmamış bildirim yok"}</span>
      <Button variant="outline" disabled={!visibleUnread.length || visibleUnread.some(row => pendingIds.has(row.id))} onClick={() => markRead(visibleUnread.map(row => row.id))}>Görünenleri okundu işaretle</Button>
    </div>}
    {error && <p className="activity-error" role="alert">{error}</p>}
    {showLoading ? <LoadingSpinner label="Bildirimler yükleniyor" /> : data.loadError ? <div className="activity-load-error" role="alert"><p>{data.loadError}</p><Button variant="outline" disabled={retrying} onClick={() => void retryLoad()}>{retrying ? "Yeniden deneniyor…" : "Tekrar dene"}</Button></div> : data.notifications.length ? <ul className="activity-list" aria-label="Bildirimler">
      {data.notifications.map(notification => <NotificationRow key={notification.id} notification={notification} isRead={!!notification.readAt || readOverrides.has(notification.id)} pending={pendingIds.has(notification.id)} onMarkRead={id => markRead([id])} />)}
    </ul> : <div className="activity-empty">
      <h2>{data.nextCursor ? "Bu sayfada görüntülenebilir bildirim yok" : kind === "all" ? "Henüz bildirim yok" : `Henüz ${tabs.find(tab => tab.kind === kind)?.label.toLocaleLowerCase("tr-TR")} bildirimi yok`}</h2>
      <p>{data.nextCursor ? "Diğer sayfaya geçerek devam edebilirsin." : "Yeni bir yanıt, beğeni veya takip olduğunda burada göreceksin."}</p>
      {!data.nextCursor && <Button variant="outline" asChild><Link to="/">Ana sayfaya dön</Link></Button>}
    </div>}
    {!data.loadError && (cursor || data.nextCursor) && <nav className="activity-pagination" aria-label="Bildirim sayfaları">
      {history.length ? <Button variant="outline" disabled={loading} onClick={() => goTo(kind, history.at(-1) || "", history.slice(0, -1))}>Önceki</Button> : cursor ? <Button variant="outline" onClick={() => goTo(kind, "", [])}>İlk sayfa</Button> : <span />}
      <Button variant="outline" disabled={loading || !data.nextCursor} onClick={() => data.nextCursor && goTo(kind, data.nextCursor, [...history, cursor].slice(-20))}>Sonraki</Button>
    </nav>}
  </section>;
}

export function loadActivity(kind: NonNullable<ActivitySearch["kind"]> = "all", cursor = "") {
  const params = new URLSearchParams({ kind });
  if (cursor) params.set("cursor", cursor);
  return api<ActivityPageData>(`/notifications?${params.toString()}`).catch(error => {
    if (isRedirect(error)) throw error;
    return { notifications: [], nextCursor: null, unreadCount: 0, loadError: "Bildirimler yüklenemedi. Bağlantını kontrol edip tekrar dene." };
  });
}
