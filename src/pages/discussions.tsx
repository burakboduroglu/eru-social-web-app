import { isRedirect, Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { CreateSubjectResult, Subject, SubjectDetailData, SubjectEntryPage, SubjectPage } from "../../shared/discussion-types";
import { api, invalidateApiCache } from "../lib/api";
import { Icon, useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination } from "../components/feature-tools";
import { FeatureEmpty, FeatureHeader, FeatureSection } from "../components/feature-presentation";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import "../components/reading-events.css";
import "../components/discussions.css";

type Search = { filter?: string; q?: string; communityId?: string; cursor?: string; cursorHistory?: string[] };
type ListData = SubjectPage & { loadError?: string };
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const day = (value: string) => new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export async function loadSubjects(search: Search): Promise<ListData> {
  const params = new URLSearchParams({ filter: search.filter || "all" });
  if (search.q) params.set("q", search.q);
  if (search.communityId) params.set("communityId", search.communityId);
  if (search.cursor) params.set("cursor", search.cursor);
  try { return await api<SubjectPage>(`/subjects?${params}`); }
  catch (error) {
    if (isRedirect(error)) throw error;
    return { items: [], nextCursor: null, loadError: message(error, "Başlıklar yüklenemedi. Tekrar dene.") };
  }
}
export async function loadSubject(id: string, cursor?: string): Promise<SubjectDetailData> {
  const [subject, entries] = await Promise.all([api<Subject>(`/subjects/${id}`), api<SubjectEntryPage>(`/subjects/${id}/entries${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`)]);
  return { subject, entries };
}

export function DiscussionsPage() {
  const data = useLoaderData({ strict: false }) as ListData, search = useSearch({ strict: false }) as Search;
  const { communities } = useMe(), navigate = useNavigate(), router = useRouter(), loading = useContentLoading(), showLoading = useDelayedLoading(loading);
  const filter = search.filter || "all", reset = { cursor: "", cursorHistory: [] as string[] };
  const [title, setTitle] = useState(""), [communityId, setCommunityId] = useState(communities[0]?.id || ""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<CreateSubjectResult>("/subjects", "POST", { title, communityId });
      invalidateApiCache();
      if (result.reused) setNotice("Bu başlık zaten vardı; mevcut başlığa yönlendirildin.");
      await navigate({ to: `/discussions/${result.subject.id}` });
    } catch (caught) { setError(message(caught, "Başlık açılamadı. Metnin korunuyor.")); }
    finally { setBusy(false); }
  }
  return <section className="feature-page discussions-page"><FeatureHeader title="Tartışmalar" eyebrow="Konu başlıkları" description="Topluluğunun konu başlıklarında görüşlerini paylaş." />
    <nav className="reading-view-nav" aria-label="Başlık görünümü">{[["all", "Tümü"], ["following", "Takip ettiklerim"], ["saved", "Kaydedilenler"]].map(([value, label]) => <Link key={value} to="/discussions" search={{ ...search, filter: value, ...reset } as never} aria-current={filter === value ? "page" : undefined}>{label}</Link>)}</nav>
    <form className="feature-filters" key={`${filter}:${search.q}:${search.communityId}`} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void navigate({ search: { filter, q: String(form.get("q") || ""), communityId: String(form.get("communityId") || ""), ...reset } as never }); }}>
      <label>Başlık ara<input name="q" maxLength={120} defaultValue={search.q || ""} /></label>
      {communities.length > 0 && <label>Topluluk<select name="communityId" defaultValue={search.communityId || ""}><option value="">Tüm topluluklar</option>{communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <Button variant="outline" disabled={loading}>Uygula</Button>
    </form>
    {communities.length > 0 && <form className="feature-form discussion-create" onSubmit={create}><FeatureSection title="Yeni başlık aç" description="Aynı topluluktaki aynı başlık yeniden oluşturulmaz; mevcut başlık açılır."><div className="feature-form-grid">
      <label>Topluluk<select value={communityId} onChange={e => setCommunityId(e.target.value)} disabled={busy}>{communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Başlık<input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /></label></div>
      <ErrorMessage message={error} />{notice && <p className="feature-note" role="status">{notice}</p>}<Button disabled={busy || !title.trim()}>{busy ? "Açılıyor…" : "Başlığı aç"}</Button></FeatureSection></form>}
    <div className="reading-results" aria-busy={loading} aria-label="Başlık sonuçları">{showLoading ? <LoadingSpinner label="Başlıklar yükleniyor" /> : data.loadError ? <FeatureSection title="Başlıklar yüklenemedi"><ErrorMessage message={data.loadError} /><Button variant="outline" disabled={loading} onClick={() => { invalidateApiCache(); void router.invalidate(); }}>Tekrar dene</Button></FeatureSection>
      : data.items.length ? <div className="reading-list">{data.items.map(subject => <article className="reading-card" key={subject.id}><div className="reading-card-top"><Link className="event-community" to={`/communities/${subject.communityId}`}>{subject.community.name}</Link>{subject.status === "locked" && <span className="reading-status">Kilitli</span>}{subject.following && <span className="reading-status">Takipte</span>}{subject.saved && <span className="reading-status">Kayıtlı</span>}</div>
        <Link className="reading-title-link" to={`/discussions/${subject.id}`}><h2>{subject.title}</h2></Link><p className="reading-kicker">{subject.entryCount} görüş{subject.latestEntryAt ? ` · Son görüş ${day(subject.latestEntryAt)}` : ""}</p></article>)}</div>
      : <FeatureEmpty icon={<Icon name="community" size={24} />} title={filter === "following" ? "Takip ettiğin başlık yok" : filter === "saved" ? "Kaydettiğin başlık yok" : search.q || search.communityId ? "Eşleşen başlık bulunamadı" : "Henüz başlık yok"} description={filter === "all" ? "İlk başlığı açarak konuşmayı başlat." : "Başlık sayfasından takip edebilir veya kaydedebilirsin. Takip etmek bildirim göndermez."} action={filter !== "all" || search.q || search.communityId ? <Button asChild variant="outline"><Link to="/discussions" search={{ filter: "all", q: "", communityId: "", ...reset } as never}>Tüm başlıkları göster</Link></Button> : undefined} />}</div>
    {!data.loadError && <FeaturePagination nextCursor={data.nextCursor} />}
  </section>;
}

export function DiscussionDetailPage() {
  const { subject, entries } = useLoaderData({ strict: false }) as SubjectDetailData, { profile } = useMe(), router = useRouter(), search = useSearch({ strict: false }) as Search;
  const [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = subject.status === "locked";
  async function run(action: () => Promise<unknown>, after?: () => void) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); invalidateApiCache(); after?.(); await router.invalidate(); }
    catch (caught) { setError(message(caught, "İşlem tamamlanamadı.")); }
    finally { setBusy(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); if (body.trim()) void run(() => api(`/subjects/${subject.id}/entries`, "POST", { body }), () => setBody("")); };
  return <section className="feature-page discussions-page"><Link className="reading-back" to="/discussions">← Tartışmalara dön</Link>
    <FeatureHeader title={subject.title} eyebrow={locked ? "Kilitli başlık" : "Açık başlık"} description={<Link to={`/communities/${subject.communityId}`}>{subject.community.name}</Link>} />
    <div className="feature-actions"><Button variant="outline" disabled={busy} aria-pressed={subject.following} onClick={() => void run(() => api(`/subjects/${subject.id}/follow`, subject.following ? "DELETE" : "PUT", {}))}>{subject.following ? "Takibi bırak" : "Takip et"}</Button><Button variant="outline" disabled={busy} aria-pressed={subject.saved} onClick={() => void run(() => api(`/subjects/${subject.id}/save`, subject.saved ? "DELETE" : "PUT", {}))}>{subject.saved ? "Kaydı kaldır" : "Kaydet"}</Button>
      {subject.canModerate && <Button variant="outline" disabled={busy} onClick={() => { if (!locked || window.confirm("Başlık yeniden açılsın mı?")) void run(() => api(`/subjects/${subject.id}`, "PATCH", { status: locked ? "open" : "locked", version: subject.version })); }}>{locked ? "Kilidi aç" : "Başlığı kilitle"}</Button>}</div>
    <p className="feature-note">Takip ve kayıt yalnızca sana görünür; bildirim göndermez.</p>
    <FeatureSection title={`Görüşler (${subject.entryCount})`}>{entries.items.length ? <ol className="discussion-entries">{entries.items.map(entry => <li key={entry.id} className="discussion-entry"><header><Link to={`/profile/${entry.author.id}`}>{entry.author.name}</Link><time dateTime={entry.createdAt}>{day(entry.createdAt)}</time></header><p>{entry.body}</p>{(entry.authorId === profile.id || subject.canModerate) && <Button variant="ghost" className="reading-danger" disabled={busy} onClick={() => { if (window.confirm("Görüş silinsin mi?")) void run(() => api(`/subjects/${subject.id}/entries/${entry.id}`, "DELETE")); }}>Sil</Button>}</li>)}</ol> : <p>Henüz görüş yok.</p>}
      <FeaturePagination nextCursor={entries.nextCursor} /></FeatureSection>
    {locked ? <p className="feature-note" role="status">Bu başlık yeni görüşlere kapalı. Mevcut görüşleri okuyabilirsin.</p> : subject.joined ? <form className="feature-form" onSubmit={submit}><FeatureSection title="Görüşünü ekle"><label>Görüş<textarea required rows={4} maxLength={2000} value={body} disabled={busy} onChange={e => setBody(e.target.value)} /></label><Button disabled={busy || !body.trim()}>{busy ? "Gönderiliyor…" : "Görüşü paylaş"}</Button></FeatureSection></form> : <p className="feature-note">Görüş eklemek için <Link to={`/communities/${subject.communityId}`}>topluluğa katıl</Link>.</p>}
    <ErrorMessage message={error} />
  </section>;
}
