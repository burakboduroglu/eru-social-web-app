import { Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { Job, ResourcePage } from "../../shared/types";
import { api } from "../lib/api";
import { useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination, externalDomain, safeExternal, useFormGuard, localInput, utcInput } from "../components/feature-tools";
const modes = { remote: "Uzaktan", onsite: "Ofiste", hybrid: "Hibrit" }, types = { "full-time": "Tam zamanlı", "part-time": "Yarı zamanlı", contract: "Sözleşmeli", internship: "Staj" }, statuses = { draft: "Taslak", published: "Yayında", closed: "Kapalı" };
export function jobSearch(s: Record<string, unknown>) {
    return { q: String(s.q || "").slice(0, 120), location: String(s.location || "").slice(0, 120), mode: String(s.mode || ""), type: String(s.type || ""), filter: s.filter === "mine" || s.filter === "saved" ? s.filter : "all" };
}
export function loadJobs(s: Record<string, unknown>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(s))
        if (v && k !== "cursorHistory")
            p.set(k, String(v));
    return api<ResourcePage<Job>>(`/jobs${p.size ? `?${p}` : ""}`);
}
export function JobsPage() {
    const data = useLoaderData({ strict: false }) as ResourcePage<Job>, search = useSearch({ strict: false }) as ReturnType<typeof jobSearch>, navigate = useNavigate();
    return <section className="feature-page"><header className="feature-heading"><div><h1>İş ilanları</h1><p>Üyelerin paylaştığı ilanlar. Başvurular dış sitede yapılır.</p></div><Button asChild><Link to="/jobs/new">İlan oluştur</Link></Button></header><form className="feature-filters" key={JSON.stringify(search)} onSubmit={e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void navigate({ search: { ...Object.fromEntries(f), cursor: "", cursorHistory: [] } as never });
    }}><input name="q" aria-label="İlan veya şirket ara" placeholder="İlan veya şirket" defaultValue={search.q}/><input name="location" aria-label="Konum" placeholder="Konum" defaultValue={search.location}/><select name="mode" aria-label="Çalışma şekli" defaultValue={search.mode}><option value="">Tüm çalışma şekilleri</option>{Object.entries(modes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><select name="type" aria-label="İstihdam türü" defaultValue={search.type}><option value="">Tüm türler</option>{Object.entries(types).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><select name="filter" aria-label="İlan görünümü" defaultValue={search.filter}><option value="all">Tüm ilanlar</option><option value="saved">Kaydettiklerim</option><option value="mine">İlanlarım</option></select><Button type="submit" variant="outline">Filtrele</Button></form><div className="feature-list">{data.items.map(job => <article className="feature-card" key={job.id}><Link to={`/jobs/${job.id}`}><h2>{job.title}</h2></Link><p>{job.company} · {job.location || modes[job.workMode]}</p><div className="feature-meta"><span>{modes[job.workMode]} · {types[job.employmentType]}</span><span className="feature-status">{statuses[job.status]}</span><time dateTime={job.createdAt}>Oluşturuldu: {new Date(job.createdAt).toLocaleDateString("tr-TR")}</time>{job.saved && <span>Kaydedildi</span>}</div></article>)}</div>{!data.items.length && <p className="feature-empty">Bu filtrelerle ilan bulunamadı.</p>}<FeaturePagination nextCursor={data.nextCursor}/></section>;
}
export function JobFormPage({ edit = false }: {
    edit?: boolean;
}) {
    const data = useLoaderData({ strict: false }) as Job | undefined;
    const { profile } = useMe();
    if (edit && data && data.ownerId !== profile.id)
        return <section className="feature-page"><p className="feature-empty">Bu ilanı yalnızca yayınlayan kişi düzenleyebilir.</p><Link to={`/jobs/${data.id}`}>İlana dön</Link></section>;
    return <JobEditor key={edit ? data?.id : "new"} job={edit ? data : undefined}/>;
}
function JobEditor({ job }: {
    job?: Job;
}) {
    const initial = { title: job?.title || "", company: job?.company || "", location: job?.location || "", description: job?.description || "", workMode: job?.workMode || "remote", employmentType: job?.employmentType || "full-time", applicationUrl: job?.applicationUrl || "", deadline: localInput(job?.deadline) };
    const [values, setValues] = useState(initial), [error, setError] = useState(""), [busy, setBusy] = useState(false), [preview, setPreview] = useState(false);
    const guard = useFormGuard(values, initial), navigate = useNavigate();
    const update = (key: keyof typeof values, value: string) => setValues(v => ({ ...v, [key]: value }));
    async function save(e: FormEvent) {
        e.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setError("");
        try {
            const saved = await api<Job>(job ? `/jobs/${job.id}` : "/jobs", job ? "PATCH" : "POST", { ...values, deadline: utcInput(values.deadline), status: job?.status || "draft", version: job?.version });
            guard.commit();
            await navigate({ to: `/jobs/${saved.id}` });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "İlan kaydedilemedi.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="feature-page"><header className="feature-heading"><div><h1>{job ? "İlanı düzenle" : "Yeni iş ilanı"}</h1><p>Önce taslak olarak kaydet; önizlemeden sonra yayınla.</p></div></header><form className="feature-form" onSubmit={save}>{([['title', 'İlan başlığı', 120], ['company', 'Şirket', 120], ['location', 'Konum', 120]] as const).map(([key, label, max]) => <label key={key}>{label}<input required={key !== "location"} maxLength={max} value={values[key]} onChange={e => update(key, e.target.value)}/></label>)}<div className="feature-form-grid"><label>Çalışma şekli<select value={values.workMode} onChange={e => update("workMode", e.target.value)}>{Object.entries(modes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>İstihdam türü<select value={values.employmentType} onChange={e => update("employmentType", e.target.value)}>{Object.entries(types).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div><label>Açıklama<textarea required rows={10} maxLength={20000} value={values.description} onChange={e => update("description", e.target.value)}/></label><label>HTTPS başvuru bağlantısı<input required type="url" maxLength={2048} placeholder="https://" value={values.applicationUrl} onChange={e => update("applicationUrl", e.target.value)}/></label><label>Son başvuru zamanı (isteğe bağlı)<input type="datetime-local" value={values.deadline} onChange={e => update("deadline", e.target.value)}/></label><ErrorMessage message={error}/><div className="feature-actions"><Button disabled={busy} type="submit">{busy ? "Kaydediliyor…" : job ? "Değişiklikleri kaydet" : "Taslağı kaydet"}</Button><Button type="button" variant="outline" onClick={() => setPreview(v => !v)}>Önizleme</Button><Link to={job ? `/jobs/${job.id}` : "/jobs"}>Vazgeç</Link></div></form>{preview && <article className="feature-preview"><h2>{values.title || "İlan başlığı"}</h2><p>{values.company} · {values.location}</p><p className="feature-body">{values.description}</p><p className="feature-note">Başvuru sitesi: {externalDomain(values.applicationUrl) || "Geçerli bağlantı gir"}</p></article>}</section>;
}
export function JobDetailPage() {
    const job = useLoaderData({ strict: false }) as Job, { profile } = useMe(), router = useRouter(), navigate = useNavigate();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const owner = profile.id === job.ownerId, expired = !!job.deadline && Date.parse(job.deadline) <= Date.now(), canApply = job.status === "published" && !expired;
    async function act(action: string) {
        if (busy)
            return;
        if (action === "delete" && !window.confirm("İlan kalıcı olarak silinsin mi?"))
            return;
        setBusy(true);
        setError("");
        try {
            if (action === "delete") {
                await api(`/jobs/${job.id}`, "DELETE");
                await navigate({ to: "/jobs" });
            }
            else if (action === "save") {
                await api(`/jobs/${job.id}/save`, job.saved ? "DELETE" : "PUT", {});
                await router.invalidate();
            }
            else {
                await api(`/jobs/${job.id}`, "PATCH", { ...job, status: action, version: job.version });
                await router.invalidate();
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="feature-page"><header className="feature-heading"><div><h1>{job.title}</h1><p>{job.company} · {job.location || modes[job.workMode]}</p></div><span className="feature-status">{statuses[job.status]}</span></header><div className="feature-meta"><span>{modes[job.workMode]} · {types[job.employmentType]}</span><time dateTime={job.createdAt}>Oluşturuldu: {new Date(job.createdAt).toLocaleDateString("tr-TR")}</time><Link to={`/profile/${job.publisher.id}`}>Yayınlayan: {job.publisher.name}</Link>{job.deadline && <span>Son başvuru: {new Date(job.deadline).toLocaleString("tr-TR")}</span>}</div><p className="feature-body">{job.description}</p><p className="feature-note">Başvuru sitesi: {externalDomain(job.applicationUrl)}. Dış siteye geçiş, başvuru gönderdiğin anlamına gelmez.</p><ErrorMessage message={error}/><div className="feature-actions">{canApply && safeExternal(job.applicationUrl) ? <Button asChild><a href={safeExternal(job.applicationUrl)} target="_blank" rel="noopener noreferrer">Dış sitede başvur</a></Button> : <Button disabled>{expired ? "Başvuru süresi doldu" : "Başvuru kapalı"}</Button>}{job.status !== "draft" && <Button variant="outline" disabled={busy} onClick={() => act("save")}>{job.saved ? "Kaydı kaldır" : "Kaydet"}</Button>}{owner && <><Button asChild variant="outline"><Link to={`/jobs/${job.id}/edit`}>Düzenle</Link></Button>{job.status === "draft" && <Button disabled={busy} onClick={() => act("published")}>Yayınla</Button>}{job.status === "published" && <Button variant="outline" disabled={busy} onClick={() => act("closed")}>İlanı kapat</Button>}<Button variant="outline" disabled={busy} onClick={() => act("delete")}>Sil</Button></>}</div></section>;
}
