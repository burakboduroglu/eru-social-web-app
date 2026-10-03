import { isRedirect, Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { CommunityEvent, ResourcePage } from "../../shared/types";
import { api, invalidateApiCache } from "../lib/api";
import { Icon, useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination, externalDomain, safeExternal, useFormGuard, localInput, utcInput } from "../components/feature-tools";
import { FeatureEmpty, FeatureHeader, FeatureSection } from "../components/feature-presentation";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import "../components/reading-events.css";

type EventsData = ResourcePage<CommunityEvent> & { loadError?: string };
export async function loadEvents(search: { period?: string; communityId?: string; cursor?: string }): Promise<EventsData> {
  const params = new URLSearchParams({ period: search.period || "upcoming" });
  if (search.communityId) params.set("communityId", search.communityId);
  if (search.cursor) params.set("cursor", search.cursor);
  try { return await api<ResourcePage<CommunityEvent>>(`/events?${params}`); }
  catch (error) {
    if (isRedirect(error)) throw error;
    return { items: [], nextCursor: null, loadError: error instanceof Error ? error.message : "Etkinlikler yüklenemedi. Tekrar dene." };
  }
}
const localTime = (value: string) => new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const clockTime = (value: string) => new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
function EventDate({ value }: { value: string }) {
  const date = new Date(value);
  return <time className="event-date-tile" dateTime={value} aria-label={localTime(value)}><span>{date.toLocaleDateString("tr-TR", { month: "short" })}</span><strong>{date.getDate()}</strong><span>{date.getFullYear()}</span></time>;
}
function eventState(event: CommunityEvent) {
  return event.status === "cancelled" ? "İptal edildi" : Date.parse(event.startsAt) <= Date.now() ? "Geçmiş etkinlik" : event.rsvped ? "Katılacağım" : "Yaklaşan etkinlik";
}
export function EventsPage() {
  const data = useLoaderData({ strict: false }) as EventsData, search = useSearch({ strict: false }) as { period?: string; communityId?: string };
  const { communities } = useMe(), navigate = useNavigate(), router = useRouter(), loading = useContentLoading(), showLoading = useDelayedLoading(loading), past = search.period === "past";
  return <section className="feature-page events-page"><FeatureHeader title="Topluluk etkinlikleri" eyebrow="Bir araya gel" description="Katıldığın toplulukların buluşmalarını takip et." action={<Button asChild><Link to={communities.length ? "/events/new" : "/communities"} search={communities.length ? search as never : undefined}>{communities.length ? "Etkinlik oluştur" : "Toplulukları keşfet"}</Link></Button>} />
    <nav className="reading-view-nav" aria-label="Etkinlik zamanı"><Link to="/events" search={{ communityId: search.communityId || "", period: "upcoming", cursor: "", cursorHistory: [] } as never} aria-current={!past ? "page" : undefined}>Yaklaşan</Link><Link to="/events" search={{ communityId: search.communityId || "", period: "past", cursor: "", cursorHistory: [] } as never} aria-current={past ? "page" : undefined}>Geçmiş</Link></nav>
    {communities.length > 0 && <form className="feature-filters events-community-filter" key={`${search.period}:${search.communityId}`} onSubmit={event => { event.preventDefault(); void navigate({ search: { period: search.period || "upcoming", communityId: new FormData(event.currentTarget).get("communityId") || "", cursor: "", cursorHistory: [] } as never }); }}><label>Topluluk<select aria-label="Etkinlik topluluğu" name="communityId" defaultValue={search.communityId || ""}><option value="">Katıldığım tüm topluluklar</option>{communities.map(community => <option key={community.id} value={community.id}>{community.name}</option>)}</select></label><Button variant="outline" disabled={loading}>Uygula</Button></form>}
    <div className="events-results" aria-busy={loading} aria-label="Etkinlik sonuçları">{showLoading ? <LoadingSpinner label="Etkinlikler yükleniyor" /> : data.loadError ? <FeatureSection title="Etkinlikler yüklenemedi"><ErrorMessage message={data.loadError} /><Button variant="outline" disabled={loading} onClick={() => { invalidateApiCache(); void router.invalidate(); }}>Tekrar dene</Button></FeatureSection> : data.items.length ? <div className="events-list">{data.items.map(event => <article className={`event-card${event.status === "cancelled" ? " is-cancelled" : ""}`} key={event.id}><EventDate value={event.startsAt} /><div className="event-card-body"><div className="event-card-top"><Link className="event-community" to={`/communities/${event.communityId}`}>{event.community.name}</Link><span className={`event-state${event.rsvped && event.status !== "cancelled" ? " is-attending" : ""}`}>{eventState(event)}</span></div><Link className="reading-title-link" to={`/events/${event.id}`} search={search as never}><h2>{event.title}</h2></Link><p className="event-clock"><Icon name="calendar" size={15} /><time dateTime={event.startsAt}>{clockTime(event.startsAt)}</time>{event.endsAt && <span>– {new Date(event.startsAt).toDateString() === new Date(event.endsAt).toDateString() ? clockTime(event.endsAt) : localTime(event.endsAt)}</span>}<span>Yerel saat</span></p>{event.description && <p className="event-excerpt">{event.description}</p>}</div></article>)}</div> : <FeatureEmpty icon={<Icon name="calendar" size={24} />} title={!communities.length ? "Bir toplulukla başla" : search.communityId ? "Bu toplulukta etkinlik yok" : past ? "Henüz geçmiş etkinlik yok" : "Takvim şimdilik boş"} description={!communities.length ? "Etkinlikleri ve toplantı bağlantılarını görmek için önce bir topluluğa katıl." : past ? "Tamamlanan etkinlikler burada yer alır." : "Bir buluşma oluşturarak topluluğunu bir araya getirebilirsin."} action={<Button asChild variant="outline"><Link to={!communities.length ? "/communities" : search.communityId ? "/events" : past ? "/events" : "/events/new"} search={!communities.length ? undefined : search.communityId ? { ...search, communityId: "", cursor: "", cursorHistory: [] } as never : past ? { ...search, period: "upcoming", communityId: "", cursor: "", cursorHistory: [] } as never : search as never}>{!communities.length ? "Toplulukları keşfet" : search.communityId ? "Tüm toplulukları göster" : past ? "Yaklaşan etkinliklere bak" : "Etkinlik oluştur"}</Link></Button>} />}</div>{!data.loadError && <FeaturePagination nextCursor={data.nextCursor} />}
  </section>;
}
export function EventFormPage({ edit = false }: { edit?: boolean }) {
  const row = useLoaderData({ strict: false }) as CommunityEvent | undefined;
  return <EventEditor key={edit ? row?.id : "new"} event={edit ? row : undefined} />;
}
function EventEditor({ event }: { event?: CommunityEvent }) {
  const { communities, profile } = useMe(), navigate = useNavigate(), search = useSearch({ strict: false });
  const initial = { title: event?.title || "", description: event?.description || "", communityId: event?.communityId || communities[0]?.id || "", startsAt: localInput(event?.startsAt), endsAt: localInput(event?.endsAt), meetingUrl: event?.meetingUrl || "" };
  const [values, setValues] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const guard = useFormGuard(values, initial), update = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  async function save(form: FormEvent) {
    form.preventDefault(); if (busy) return;
    if (values.endsAt && values.endsAt <= values.startsAt) { setError("Bitiş saati başlangıçtan sonra olmalı."); return; }
    if (values.meetingUrl && !safeExternal(values.meetingUrl)) { setError("Toplantı bağlantısı geçerli bir HTTPS adresi olmalı."); return; }
    setBusy(true); setError("");
    try {
      const row = await api<CommunityEvent>(event ? `/events/${event.id}` : "/events", event ? "PATCH" : "POST", { ...values, startsAt: utcInput(values.startsAt), endsAt: utcInput(values.endsAt), status: event?.status || "active", version: event?.version });
      guard.commit(); await navigate({ to: `/events/${row.id}`, search: search as never });
    } catch (error) { setError(error instanceof Error ? error.message : "Etkinlik kaydedilemedi."); }
    finally { setBusy(false); }
  }
  if (event && event.ownerId !== profile.id) return <section className="feature-page events-page"><FeatureEmpty icon={<Icon name="calendar" size={24} />} title="Bu etkinliği yalnızca oluşturan kişi düzenleyebilir" action={<Button asChild variant="outline"><Link to={`/events/${event.id}`} search={search as never}>Etkinliğe dön</Link></Button>} /></section>;
  if (!communities.length) return <section className="feature-page events-page"><FeatureHeader title="Etkinlik oluştur" /><FeatureEmpty icon={<Icon name="community" size={24} />} title="Önce bir topluluğa katıl" description="Etkinlikler topluluk üyeleri için oluşturulur." action={<Button asChild><Link to="/communities">Toplulukları keşfet</Link></Button>} /></section>;
  return <section className="feature-page events-page"><FeatureHeader title={event ? "Etkinliği düzenle" : "Yeni etkinlik"} description="Etkinliğini yalnızca seçtiğin topluluğun üyeleri görebilir." /><form className="feature-form" onSubmit={save}><fieldset className="reading-form-fields" disabled={busy}>
    <FeatureSection title="Buluşma hakkında"><label>Topluluk<select required disabled={!!event} value={values.communityId} onChange={e => update("communityId", e.target.value)}>{communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Başlık<input required maxLength={120} value={values.title} onChange={e => update("title", e.target.value)} /></label><label>Açıklama<textarea rows={6} maxLength={2000} value={values.description} onChange={e => update("description", e.target.value)} /></label></FeatureSection>
    <FeatureSection title="Tarih ve saat" description="Saatleri bulunduğun saat dilimine göre gir."><div className="feature-form-grid"><label>Başlangıç<input required type="datetime-local" value={values.startsAt} onChange={e => update("startsAt", e.target.value)} /></label><label><span>Bitiş <small className="reading-optional">İsteğe bağlı</small></span><input type="datetime-local" min={values.startsAt || undefined} value={values.endsAt} onChange={e => update("endsAt", e.target.value)} /></label></div></FeatureSection>
    <FeatureSection title="Toplantı bağlantısı" description="İsteğe bağlı. Bağlantı topluluk üyelerine gösterilir."><label>HTTPS adresi<input type="url" maxLength={2048} placeholder="https://" value={values.meetingUrl} onChange={e => update("meetingUrl", e.target.value)} /></label>{safeExternal(values.meetingUrl) && <p className="feature-note">Toplantı sitesi: {externalDomain(values.meetingUrl)}</p>}</FeatureSection>
    </fieldset><ErrorMessage message={error} /><div className="feature-actions reading-editor-actions"><Button disabled={busy}>{busy ? "Kaydediliyor…" : "Etkinliği kaydet"}</Button><Button asChild variant="ghost"><Link to={event ? `/events/${event.id}` : "/events"} search={search as never}>Vazgeç</Link></Button></div></form></section>;
}
export function EventDetailPage() {
  const event = useLoaderData({ strict: false }) as CommunityEvent, { profile } = useMe(), router = useRouter(), navigate = useNavigate(), search = useSearch({ strict: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const owner = event.ownerId === profile.id, past = Date.parse(event.startsAt) <= Date.now(), available = event.status === "active" && !past, meetingUrl = safeExternal(event.meetingUrl);
  async function act(action: "rsvp" | "cancel" | "delete") {
    if (busy || action === "delete" && !window.confirm("Etkinlik kalıcı olarak silinsin mi?")) return;
    if (action === "cancel" && !window.confirm("Etkinlik iptal edilsin mi?")) return;
    setBusy(true); setError("");
    try {
      if (action === "rsvp") await api(`/events/${event.id}/rsvp`, event.rsvped ? "DELETE" : "PUT", {});
      else await api(`/events/${event.id}`, action === "delete" ? "DELETE" : "PATCH", action === "delete" ? undefined : { ...event, status: "cancelled", version: event.version });
      if (action === "delete") await navigate({ to: "/events", search: search as never }); else await router.invalidate();
    } catch (error) { setError(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
    finally { setBusy(false); }
  }
  return <section className="feature-page events-page event-detail"><Link className="reading-back" to="/events" search={search as never}>← Etkinliklere dön</Link><FeatureHeader title={event.title} eyebrow={eventState(event)} description={event.community.name} />
    <div className="event-detail-summary"><EventDate value={event.startsAt} /><div className="event-detail-time"><time dateTime={event.startsAt}>{localTime(event.startsAt)}</time>{event.endsAt && <p>Bitiş: <time dateTime={event.endsAt}>{localTime(event.endsAt)}</time></p>}<p>Yerel saat · <Link to={`/communities/${event.communityId}`}>{event.community.name}</Link></p></div></div>
    <FeatureSection className="event-attendance" title="Katılım tercihin" description="Tercihin yalnızca sana görünür. Katılımcı listesi yayınlanmaz."><p className={`event-rsvp-state${event.rsvped ? " is-attending" : ""}`} role="status">{busy ? "İşlemin kaydediliyor…" : event.rsvped ? "Bu etkinliğe katılacağını belirttin." : available ? "Bu buluşmaya katılmak ister misin?" : "Bu etkinlik için yeni katılım alınmıyor."}</p><div className="feature-actions"><Button disabled={busy || !available && !event.rsvped} onClick={() => act("rsvp")}>{event.rsvped ? "Katılımı geri al" : available ? "Katılacağım" : "Katılım kapalı"}</Button>{available && meetingUrl && <Button asChild variant="outline"><a href={meetingUrl} target="_blank" rel="noopener noreferrer">Toplantıyı aç <Icon name="share" size={16} /></a></Button>}</div>{event.meetingUrl && <p className="feature-note">Dış toplantı sitesi: {externalDomain(event.meetingUrl) || "Geçersiz bağlantı"}</p>}<ErrorMessage message={error} /></FeatureSection>
    <FeatureSection title="Etkinlik hakkında"><p className="reading-body event-description">{event.description || "Bu etkinlik için açıklama eklenmedi."}</p><p className="event-publisher">Oluşturan: <Link to={`/profile/${event.publisher.id}`}>{event.publisher.name}</Link></p></FeatureSection>
    {owner && <FeatureSection className="reading-owner-tools" title="Etkinliği yönet" description="Etkinlik bilgilerini ve durumunu buradan yönetebilirsin."><div className="feature-actions">{available && <Button asChild variant="outline"><Link to={`/events/${event.id}/edit`} search={search as never}>Düzenle</Link></Button>}{event.status === "active" && <Button variant="outline" disabled={busy} onClick={() => act("cancel")}>Etkinliği iptal et</Button>}<Button className="reading-danger" variant="ghost" disabled={busy} onClick={() => act("delete")}>Sil</Button></div></FeatureSection>}
  </section>;
}
