import { Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { CommunityEvent, ResourcePage } from "../../shared/types";
import { api } from "../lib/api";
import { useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination, externalDomain, safeExternal, useFormGuard, localInput, utcInput } from "../components/feature-tools";
export function loadEvents(search: { period?: string; communityId?: string; cursor?: string }) {
  const params = new URLSearchParams({ period: search.period || "upcoming" });
  if (search.communityId) params.set("communityId", search.communityId);
  if (search.cursor) params.set("cursor", search.cursor);
  return api<ResourcePage<CommunityEvent>>(`/events?${params}`);
}
const localTime = (value: string) => new Date(value).toLocaleString("tr-TR");
export function EventsPage() {
  const data = useLoaderData({ strict: false }) as ResourcePage<CommunityEvent>, search = useSearch({ strict: false }) as { period?: string; communityId?: string };
  const { communities } = useMe(), navigate = useNavigate();
  return <section className="feature-page"><header className="feature-heading"><div><h1>Topluluk etkinlikleri</h1><p>Yalnızca mevcut topluluk üyeleri etkinlikleri ve toplantı bağlantılarını görür.</p></div><Button asChild><Link to="/events/new">Etkinlik oluştur</Link></Button></header>
    <form className="feature-filters" key={`${search.period}:${search.communityId}`} onSubmit={event => { event.preventDefault(); void navigate({ search: { ...Object.fromEntries(new FormData(event.currentTarget)), cursor: "", cursorHistory: [] } as never }); }}><select aria-label="Etkinlik zamanı" name="period" defaultValue={search.period}><option value="upcoming">Yaklaşan</option><option value="past">Geçmiş</option></select><select aria-label="Topluluk" name="communityId" defaultValue={search.communityId}><option value="">Katıldığım tüm topluluklar</option>{communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button variant="outline">Filtrele</Button></form>
    <div className="feature-list">{data.items.map(event => <article className="feature-card" key={event.id}><Link to={`/events/${event.id}`}><h2>{event.title}</h2></Link><p>{event.community.name}</p><div className="feature-meta"><time dateTime={event.startsAt}>{localTime(event.startsAt)}</time>{event.endsAt && <span>– {localTime(event.endsAt)}</span>}<span>{event.status === "cancelled" ? "İptal edildi" : event.rsvped ? "Katılacağım" : "Etkinlik"}</span></div></article>)}</div>
    {!data.items.length && <p className="feature-empty">Bu görünümde etkinlik yok. Etkinlik oluşturmak için bir topluluğa katılmalısın.</p>}<FeaturePagination nextCursor={data.nextCursor} />
  </section>;
}
export function EventFormPage({ edit = false }: { edit?: boolean }) {
  const row = useLoaderData({ strict: false }) as CommunityEvent | undefined;
  return <EventEditor key={edit ? row?.id : "new"} event={edit ? row : undefined} />;
}
function EventEditor({ event }: { event?: CommunityEvent }) {
  const { communities, profile } = useMe(), navigate = useNavigate();
  const initial = { title: event?.title || "", description: event?.description || "", communityId: event?.communityId || communities[0]?.id || "", startsAt: localInput(event?.startsAt), endsAt: localInput(event?.endsAt), meetingUrl: event?.meetingUrl || "" };
  const [values, setValues] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const guard = useFormGuard(values, initial), update = (key: keyof typeof values, value: string) => setValues(v => ({ ...v, [key]: value }));
  async function save(form: FormEvent) {
    form.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const row = await api<CommunityEvent>(event ? `/events/${event.id}` : "/events", event ? "PATCH" : "POST", { ...values, startsAt: utcInput(values.startsAt), endsAt: utcInput(values.endsAt), status: event?.status || "active", version: event?.version });
      guard.commit(); await navigate({ to: `/events/${row.id}` });
    } catch (error) { setError(error instanceof Error ? error.message : "Etkinlik kaydedilemedi."); }
    finally { setBusy(false); }
  }
  if (event && event.ownerId !== profile.id) return <section className="feature-page"><p className="feature-empty">Bu etkinliği yalnızca oluşturan kişi düzenleyebilir.</p><Link to={`/events/${event.id}`}>Etkinliğe dön</Link></section>;
  if (!communities.length) return <section className="feature-page"><h1>Etkinlik oluştur</h1><p className="feature-empty">Önce bir topluluğa katılmalısın.</p><Button asChild><Link to="/communities">Toplulukları keşfet</Link></Button></section>;
  return <section className="feature-page"><header className="feature-heading"><div><h1>{event ? "Etkinliği düzenle" : "Yeni etkinlik"}</h1><p>Saatler bulunduğun saat diliminde gösterilir ve UTC olarak kaydedilir.</p></div></header><form className="feature-form" onSubmit={save}>
    <label>Topluluk<select required disabled={!!event || busy} value={values.communityId} onChange={e => update("communityId", e.target.value)}>{communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Başlık<input required maxLength={120} value={values.title} onChange={e => update("title", e.target.value)} /></label><label>Açıklama<textarea rows={6} maxLength={2000} value={values.description} onChange={e => update("description", e.target.value)} /></label><div className="feature-form-grid"><label>Başlangıç<input required type="datetime-local" value={values.startsAt} onChange={e => update("startsAt", e.target.value)} /></label><label>Bitiş (isteğe bağlı)<input type="datetime-local" value={values.endsAt} onChange={e => update("endsAt", e.target.value)} /></label></div><label>HTTPS toplantı bağlantısı (isteğe bağlı)<input type="url" maxLength={2048} placeholder="https://" value={values.meetingUrl} onChange={e => update("meetingUrl", e.target.value)} /></label><ErrorMessage message={error} /><div className="feature-actions"><Button disabled={busy}>{busy ? "Kaydediliyor…" : "Etkinliği kaydet"}</Button><Link to={event ? `/events/${event.id}` : "/events"}>Vazgeç</Link></div>
  </form></section>;
}
export function EventDetailPage() {
  const event = useLoaderData({ strict: false }) as CommunityEvent, { profile } = useMe(), router = useRouter(), navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const owner = event.ownerId === profile.id, past = Date.parse(event.startsAt) <= Date.now(), available = event.status === "active" && !past;
  async function act(action: "rsvp" | "cancel" | "delete") {
    if (busy || action === "delete" && !window.confirm("Etkinlik kalıcı olarak silinsin mi?")) return;
    if (action === "cancel" && !window.confirm("Etkinlik iptal edilsin mi?")) return;
    setBusy(true); setError("");
    try {
      if (action === "rsvp") await api(`/events/${event.id}/rsvp`, event.rsvped ? "DELETE" : "PUT", {});
      else await api(`/events/${event.id}`, action === "delete" ? "DELETE" : "PATCH", action === "delete" ? undefined : { ...event, status: "cancelled", version: event.version });
      if (action === "delete") await navigate({ to: "/events" }); else await router.invalidate();
    } catch (error) { setError(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
    finally { setBusy(false); }
  }
  return <section className="feature-page"><header className="feature-heading"><div><h1>{event.title}</h1><p><Link to={`/communities/${event.communityId}`}>{event.community.name}</Link></p></div><span className="feature-status">{event.status === "cancelled" ? "İptal edildi" : past ? "Geçmiş etkinlik" : "Yaklaşan etkinlik"}</span></header><div className="feature-meta"><time dateTime={event.startsAt}>{localTime(event.startsAt)}</time>{event.endsAt && <span>– {localTime(event.endsAt)}</span>}<Link to={`/profile/${event.publisher.id}`}>Oluşturan: {event.publisher.name}</Link></div><p className="feature-body">{event.description}</p>
    {event.meetingUrl && <p className="feature-note">Dış toplantı sitesi: {externalDomain(event.meetingUrl)}</p>}<p className="feature-note">Katılım tercihin yalnızca sana görünür. Katılımcı listesi yayınlanmaz.</p><ErrorMessage message={error} /><div className="feature-actions"><Button disabled={busy || !available && !event.rsvped} onClick={() => act("rsvp")}>{event.rsvped ? "Katılımı geri al" : available ? "Katılacağım" : "Katılım kapalı"}</Button>{available && safeExternal(event.meetingUrl) && <Button asChild variant="outline"><a href={safeExternal(event.meetingUrl)} target="_blank" rel="noopener noreferrer">Dış toplantı bağlantısını aç</a></Button>}{owner && <>{available && <Button asChild variant="outline"><Link to={`/events/${event.id}/edit`}>Düzenle</Link></Button>}{event.status === "active" && <Button variant="outline" disabled={busy} onClick={() => act("cancel")}>İptal et</Button>}<Button variant="outline" disabled={busy} onClick={() => act("delete")}>Sil</Button></>}</div>
  </section>;
}
