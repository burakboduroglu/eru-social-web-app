import { Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { Article, ResourcePage } from "../../shared/types";
import { api } from "../lib/api";
import { Avatar, Icon, useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination, useFormGuard } from "../components/feature-tools";
import { FeatureEmpty, FeatureHeader, FeatureSection } from "../components/feature-presentation";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import "../components/reading-events.css";

export function loadArticles(search: { filter?: string; cursor?: string }) {
  const params = new URLSearchParams({ filter: search.filter || "all" });
  if (search.cursor) params.set("cursor", search.cursor);
  return api<ResourcePage<Article>>(`/articles?${params}`);
}
const articleDate = (value: string) => new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
function ArticleByline({ article }: { article: Article }) {
  return <div className="reading-byline"><Link className="reading-publisher" to={`/profile/${article.publisher.id}`}><Avatar src={article.publisher.image} name={article.publisher.name} username={article.publisher.username} /><span>{article.publisher.name}</span></Link><time dateTime={article.updatedAt} title={new Date(article.updatedAt).toLocaleString("tr-TR")}>{articleDate(article.updatedAt)}</time></div>;
}
export function ArticlesPage() {
  const data = useLoaderData({ strict: false }) as ResourcePage<Article>, search = useSearch({ strict: false }) as { filter?: string };
  const mine = search.filter === "mine", loading = useContentLoading(), showLoading = useDelayedLoading(loading);
  return <section className="feature-page reading-page">
    <FeatureHeader title="Yazılar" eyebrow="Okuma alanı" description="Topluluğun fikirleri, deneyimleri ve uzun okumalar." action={<Button asChild><Link to="/articles/new" search={search as never}>Yazı oluştur</Link></Button>} />
    <nav className="reading-view-nav" aria-label="Yazı görünümü"><Link to="/articles" search={{ filter: "all", cursor: "", cursorHistory: [] } as never} aria-current={!mine ? "page" : undefined}>Yayınlananlar</Link><Link to="/articles" search={{ filter: "mine", cursor: "", cursorHistory: [] } as never} aria-current={mine ? "page" : undefined}>Yazılarım ve taslaklarım</Link></nav>
    <div className="reading-results" aria-busy={loading} aria-label="Yazı sonuçları">{showLoading ? <LoadingSpinner label="Yazılar yükleniyor" /> : data.items.length ? <div className="reading-list">{data.items.map(row => <article className="reading-card" key={row.id}>
      <div className="reading-card-top"><span className={`reading-status${row.status === "draft" ? " is-draft" : ""}`}>{row.status === "draft" ? "Özel taslak" : "Yayında"}</span><span className="reading-card-kind">Yazı</span></div>
      <Link className="reading-title-link" to={`/articles/${row.id}`} search={search as never}><h2>{row.title}</h2></Link><p className="reading-excerpt">{row.summary || `${row.body.slice(0, 350)}${row.body.length > 350 ? "…" : ""}`}</p><ArticleByline article={row} />
    </article>)}</div> : <FeatureEmpty icon={<Icon name="article" size={24} />} title={mine ? "Henüz bir yazın yok" : "Henüz yazı yayınlanmadı"} description={mine ? "Bir fikirle başla. Taslağını kaydedip hazır olduğunda yayınlayabilirsin." : "İlk yazını paylaşarak bu okuma alanını başlatabilirsin."} action={<Button asChild><Link to="/articles/new" search={search as never}>Yazı oluştur</Link></Button>} />}</div>
    <FeaturePagination nextCursor={data.nextCursor} />
  </section>;
}
export function ArticleFormPage({ edit = false }: { edit?: boolean }) {
  const data = useLoaderData({ strict: false }) as Article | undefined, { profile } = useMe(), search = useSearch({ strict: false });
  if (edit && data && data.ownerId !== profile.id) return <section className="feature-page reading-page"><FeatureEmpty icon={<Icon name="article" size={24} />} title="Bu yazıyı yalnızca yazarı düzenleyebilir" action={<Button asChild variant="outline"><Link to={`/articles/${data.id}`} search={search as never}>Yazıya dön</Link></Button>} /></section>;
  return <ArticleEditor key={edit ? data?.id : "new"} article={edit ? data : undefined} />;
}
function ArticleEditor({ article }: { article?: Article }) {
  const initial = { title: article?.title || "", summary: article?.summary || "", body: article?.body || "" };
  const [values, setValues] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [preview, setPreview] = useState(false);
  const guard = useFormGuard(values, initial), navigate = useNavigate(), { profile } = useMe(), search = useSearch({ strict: false });
  const update = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const row = await api<Article>(article ? `/articles/${article.id}` : "/articles", article ? "PATCH" : "POST", { ...values, status: article?.status || "draft", version: article?.version });
      guard.commit(); await navigate({ to: `/articles/${row.id}`, search: search as never });
    } catch (error) { setError(error instanceof Error ? error.message : "Yazı kaydedilemedi."); }
    finally { setBusy(false); }
  }
  return <section className="feature-page reading-page reading-editor"><FeatureHeader title={article ? "Yazıyı düzenle" : "Yeni yazı"} eyebrow={article?.status === "published" ? "Yayındaki yazı" : "Özel taslak"} description={article?.status === "published" ? "Kaydettiğin değişiklikler yayındaki yazıya uygulanır." : "Taslağını yalnızca sen görürsün. Kaydettikten sonra yayınlayabilirsin."} />
    <form className="feature-form" onSubmit={save}><fieldset disabled={busy} className="reading-form-fields">
      <FeatureSection title="Başlık ve özet" description="Başlık yazının konusu olsun; özet okura ne bulacağını anlatsın."><label>Başlık<input required maxLength={120} value={values.title} onChange={event => update("title", event.target.value)} /></label><label><span>Özet <small className="reading-optional">İsteğe bağlı</small></span><textarea rows={3} maxLength={350} value={values.summary} onChange={event => update("summary", event.target.value)} /></label></FeatureSection>
      <FeatureSection title="Yazının metni" description="Düz metin ve satır sonları korunur."><label>Metin<textarea className="reading-body-input" required rows={16} maxLength={50000} value={values.body} onChange={event => update("body", event.target.value)} /></label></FeatureSection>
    </fieldset><ErrorMessage message={error} /><div className="feature-actions reading-editor-actions"><Button disabled={busy}>{busy ? "Kaydediliyor…" : article ? "Değişiklikleri kaydet" : "Taslağı kaydet"}</Button><Button type="button" variant="outline" aria-pressed={preview} aria-controls="article-preview" onClick={() => setPreview(value => !value)}>{preview ? "Önizlemeyi kapat" : "Önizleme"}</Button><Button asChild variant="ghost"><Link to={article ? `/articles/${article.id}` : "/articles"} search={search as never}>Vazgeç</Link></Button></div></form>
    {preview && <FeatureSection title="Önizleme"><article id="article-preview" className="reading-document reading-preview" aria-label="Yazı önizlemesi"><p className="reading-kicker">{profile.name} · Önizleme</p><h2>{values.title || "Yazı başlığın"}</h2>{values.summary && <p className="reading-lead">{values.summary}</p>}<div className="reading-body">{values.body || "Yazı metnin burada görünecek."}</div></article></FeatureSection>}
  </section>;
}
export function ArticleDetailPage() {
  const row = useLoaderData({ strict: false }) as Article, { profile } = useMe(), router = useRouter(), navigate = useNavigate(), search = useSearch({ strict: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function act(remove = false) {
    if (busy || remove && !window.confirm("Yazı kalıcı olarak silinsin mi?")) return;
    setBusy(true); setError("");
    try {
      await api(`/articles/${row.id}`, remove ? "DELETE" : "PATCH", remove ? undefined : { ...row, status: "published", version: row.version });
      if (remove) await navigate({ to: "/articles", search: search as never }); else await router.invalidate();
    } catch (error) { setError(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
    finally { setBusy(false); }
  }
  return <section className="feature-page reading-page reading-detail"><Link className="reading-back" to="/articles" search={search as never}>← Yazılara dön</Link><article className="reading-document"><FeatureHeader title={row.title} eyebrow={row.status === "draft" ? "Özel taslak" : "Yayınlanan yazı"} description={row.summary || undefined} /><ArticleByline article={row} /><div className="reading-body">{row.body}</div></article>
    {profile.id === row.ownerId && <FeatureSection className="reading-owner-tools" title="Yazıyı yönet" description={row.status === "draft" ? "Bu taslağı yalnızca sen görüyorsun. Yayınladığında diğer üyeler de okuyabilir." : "Yazının metnini düzenleyebilir veya yayından kaldırmak için silebilirsin."}><ErrorMessage message={error} /><div className="feature-actions"><Button asChild variant="outline"><Link to={`/articles/${row.id}/edit`} search={search as never}>Düzenle</Link></Button>{row.status === "draft" && <Button disabled={busy} onClick={() => act()}>{busy ? "İşleniyor…" : "Yayınla"}</Button>}<Button className="reading-danger" variant="ghost" disabled={busy} onClick={() => act(true)}>Sil</Button></div></FeatureSection>}
  </section>;
}
