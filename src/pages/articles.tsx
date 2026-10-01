import { Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { Article, ResourcePage } from "../../shared/types";
import { api } from "../lib/api";
import { useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination, useFormGuard } from "../components/feature-tools";
export function loadArticles(s: {
    filter?: string;
    cursor?: string;
}) {
    const p = new URLSearchParams({ filter: s.filter || "all" });
    if (s.cursor)
        p.set("cursor", s.cursor);
    return api<ResourcePage<Article>>(`/articles?${p}`);
}
export function ArticlesPage() {
    const data = useLoaderData({ strict: false }) as ResourcePage<Article>, s = useSearch({ strict: false }) as {
        filter?: string;
    };
    return <section className="feature-page"><header className="feature-heading"><div><h1>Yazılar</h1><p>Üyelerin düz metin yazıları.</p></div><Button asChild><Link to="/articles/new">Yazı oluştur</Link></Button></header><nav className="feature-actions" aria-label="Yazı görünümü"><Button variant={s.filter === "mine" ? "outline" : "default"} asChild><Link to="/articles" search={{ filter: "all", cursor: "", cursorHistory: [] } as never}>Yayınlananlar</Link></Button><Button variant={s.filter === "mine" ? "default" : "outline"} asChild><Link to="/articles" search={{ filter: "mine", cursor: "", cursorHistory: [] } as never}>Yazılarım ve taslaklarım</Link></Button></nav><div className="feature-list">{data.items.map(row => <article className="feature-card" key={row.id}><Link to={`/articles/${row.id}`}><h2>{row.title}</h2></Link>{row.summary && <p>{row.summary}</p>}<div className="feature-meta"><span>{row.publisher.name}</span><span>{row.status === "draft" ? "Özel taslak" : "Yayında"}</span><span>{new Date(row.updatedAt).toLocaleDateString("tr-TR")}</span></div></article>)}</div>{!data.items.length && <p className="feature-empty">Henüz yazı yok.</p>}<FeaturePagination nextCursor={data.nextCursor}/></section>;
}
export function ArticleFormPage({ edit = false }: {
    edit?: boolean;
}) {
    const data = useLoaderData({ strict: false }) as Article | undefined;
    const { profile } = useMe();
    if (edit && data && data.ownerId !== profile.id)
        return <section className="feature-page"><p className="feature-empty">Bu yazıyı yalnızca yazarı düzenleyebilir.</p><Link to={`/articles/${data.id}`}>Yazıya dön</Link></section>;
    return <ArticleEditor key={edit ? data?.id : "new"} article={edit ? data : undefined}/>;
}
function ArticleEditor({ article }: {
    article?: Article;
}) {
    const initial = { title: article?.title || "", summary: article?.summary || "", body: article?.body || "" };
    const [values, setValues] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [preview, setPreview] = useState(false), guard = useFormGuard(values, initial), navigate = useNavigate();
    const update = (key: keyof typeof values, value: string) => setValues(v => ({ ...v, [key]: value }));
    async function save(e: FormEvent) {
        e.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setError("");
        try {
            const row = await api<Article>(article ? `/articles/${article.id}` : "/articles", article ? "PATCH" : "POST", { ...values, status: article?.status || "draft", version: article?.version });
            guard.commit();
            await navigate({ to: `/articles/${row.id}` });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Yazı kaydedilemedi.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="feature-page"><header className="feature-heading"><div><h1>{article ? "Yazıyı düzenle" : "Yeni yazı"}</h1><p>Metin ve satır sonları korunur. Taslaklarını yalnızca sen görürsün.</p></div></header><form className="feature-form" onSubmit={save}><label>Başlık<input required maxLength={120} value={values.title} onChange={e => update("title", e.target.value)}/></label><label>Özet<textarea rows={3} maxLength={350} value={values.summary} onChange={e => update("summary", e.target.value)}/></label><label>Yazı<textarea required rows={20} maxLength={50000} value={values.body} onChange={e => update("body", e.target.value)}/></label><ErrorMessage message={error}/><div className="feature-actions"><Button disabled={busy}>{busy ? "Kaydediliyor…" : article ? "Değişiklikleri kaydet" : "Taslağı kaydet"}</Button><Button type="button" variant="outline" onClick={() => setPreview(v => !v)}>Önizleme</Button><Link to={article ? `/articles/${article.id}` : "/articles"}>Vazgeç</Link></div></form>{preview && <article className="feature-preview"><h2>{values.title}</h2><p>{values.summary}</p><div className="feature-body">{values.body}</div></article>}</section>;
}
export function ArticleDetailPage() {
    const row = useLoaderData({ strict: false }) as Article, { profile } = useMe(), router = useRouter(), navigate = useNavigate();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function act(remove = false) {
        if (busy || remove && !window.confirm("Yazı kalıcı olarak silinsin mi?"))
            return;
        setBusy(true);
        setError("");
        try {
            await api(`/articles/${row.id}`, remove ? "DELETE" : "PATCH", remove ? undefined : { ...row, status: "published", version: row.version });
            if (remove)
                await navigate({ to: "/articles" });
            else
                await router.invalidate();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="feature-page"><header className="feature-heading"><div><h1>{row.title}</h1>{row.summary && <p>{row.summary}</p>}</div><span className="feature-status">{row.status === "draft" ? "Özel taslak / önizleme" : "Yayında"}</span></header><div className="feature-meta"><Link to={`/profile/${row.publisher.id}`}>{row.publisher.name}</Link><span>Güncellendi: {new Date(row.updatedAt).toLocaleString("tr-TR")}</span></div><article className="feature-body">{row.body}</article><ErrorMessage message={error}/>{profile.id === row.ownerId && <div className="feature-actions"><Button asChild variant="outline"><Link to={`/articles/${row.id}/edit`}>Düzenle</Link></Button>{row.status === "draft" && <Button disabled={busy} onClick={() => act()}>Yayınla</Button>}<Button variant="outline" disabled={busy} onClick={() => act(true)}>Sil</Button></div>}</section>;
}
