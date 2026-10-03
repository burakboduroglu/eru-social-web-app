import { Link, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import type { Job, ResourcePage } from "../../shared/types";
import { api, invalidateApiCache } from "../lib/api";
import { getBookmarkSnapshot, subscribeBookmark, updateBookmark } from "../lib/bookmark-state";
import { responseVersion, tagResponseVersion } from "../lib/response-version";
import { useMe } from "../ui";
import { Button } from "../components/ui/button";
import { ErrorMessage, externalDomain, safeExternal, useFormGuard, localInput, utcInput } from "../components/feature-tools";
import { Icon } from "../components/icon";
import { ShareMenu } from "../components/share-menu";
import { StatePanel, ErrorScreen } from "../components/page-state";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import "../components/jobs.css";

const modes = { remote: "Uzaktan", onsite: "Ofiste", hybrid: "Hibrit" };
const types = { "full-time": "Tam zamanlı", "part-time": "Yarı zamanlı", contract: "Sözleşmeli", internship: "Staj" };
const views = { all: "Tüm ilanlar", saved: "Kaydettiklerim", mine: "İlanlarım" };
export function jobSearch(s: Record<string, unknown>) {
    return {
        q: typeof s.q === "string" ? s.q.slice(0, 120) : "",
        location: typeof s.location === "string" ? s.location.slice(0, 120) : "",
        mode: typeof s.mode === "string" && Object.hasOwn(modes, s.mode) ? s.mode : "",
        type: typeof s.type === "string" && Object.hasOwn(types, s.type) ? s.type : "",
        filter: s.filter === "mine" || s.filter === "saved" ? s.filter : "all",
    };
}
type JobsSearch = ReturnType<typeof jobSearch> & { cursor?: string; cursorHistory?: string[] };
export function loadJobs(s: Record<string, unknown>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(s)) if (v && k !== "cursorHistory") p.set(k, String(v));
    return api<ResourcePage<Job>>(`/jobs${p.size ? `?${p}` : ""}`);
}
export type JobDetailData = { job: Job; list: ResourcePage<Job> | null; listError: string };
export async function loadJobDetail(id: string, search: Record<string, unknown>): Promise<JobDetailData> {
    const details = api<Job>(`/jobs/${id}`);
    // Small screens open a focused detail page; the list is already in the API cache on return.
    const listRequest = typeof window !== "undefined" && window.matchMedia("(min-width: 1051px)").matches
        ? loadJobs(search).then(list => ({ list, listError: "" })).catch(cause => {
            if (!(cause instanceof Error)) throw cause;
            return { list: null, listError: cause.message || "İlan listesi yüklenemedi." };
        })
        : Promise.resolve({ list: null, listError: "" });
    const [job, listState] = await Promise.all([details, listRequest]);
    return { job, ...listState };
}

function useAvailabilityTime() {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const refresh = () => setNow(Date.now());
        const timer = window.setInterval(refresh, 30_000);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
    }, []);
    return now;
}
function availability(job: Pick<Job, "status" | "deadline">, now: number) {
    if (job.status === "draft") return { label: "Taslak", kind: "draft", canApply: false };
    if (job.status === "closed") return { label: "Başvuru kapalı", kind: "closed", canApply: false };
    if (job.deadline && Date.parse(job.deadline) <= now) return { label: "Süresi doldu", kind: "expired", canApply: false };
    return { label: "Başvuru açık", kind: "open", canApply: true };
}
function AvailabilityBadge({ job, now }: { job: Pick<Job, "status" | "deadline">; now: number }) {
    const state = availability(job, now);
    return <span className={`job-availability is-${state.kind}`}><span aria-hidden="true" />{state.label}</span>;
}
function CompanyTile() { return <span className="job-company-tile" aria-hidden="true"><Icon name="job" size={22} /></span>; }

function JobSave({ job, compact = false }: { job: Job; compact?: boolean }) {
    const router = useRouter(), userId = useMe().profile.id;
    const [error, setError] = useState("");
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    // Namespace jobs in the shared, account-scoped saved-resource store. Its
    // response ordering and sign-out reset also cover simultaneous card/detail controls.
    const resourceKey = `job:${job.id}`;
    const subscribe = useCallback((listener: () => void) => subscribeBookmark(userId, resourceKey, listener), [userId, resourceKey]);
    const snapshot = useCallback(() => getBookmarkSnapshot(userId, resourceKey, job.saved, job), [userId, resourceKey, job]);
    const serverSnapshot = useMemo(() => ({ bookmarked: job.saved, pending: false }), [job.saved]);
    const server = useCallback(() => serverSnapshot, [serverSnapshot]);
    const entry = useSyncExternalStore(subscribe, snapshot, server);
    const saved = entry.bookmarked, busy = entry.pending;
    async function toggle() {
        if (entry.pending) return;
        setError("");
        let completed = false;
        try {
            const changed = await updateBookmark(userId, resourceKey, !saved, async () => {
                const result = await api<{ saved: boolean }>(`/jobs/${job.id}/save`, saved ? "DELETE" : "PUT", {});
                return tagResponseVersion({ bookmarked: result.saved }, responseVersion(result));
            });
            if (!changed) return;
            completed = true;
            await router.invalidate();
        } catch (cause) {
            if (mounted.current) setError(completed ? "Kayıt güncellendi; liste yenilenemedi. Sayfayı tekrar açabilirsin." : cause instanceof Error ? cause.message : "İlan kaydedilemedi. Tekrar dene.");
        }
    }
    if (job.status === "draft") return null;
    const label = busy ? "Kaydediliyor…" : saved ? "Kaydı kaldır" : "Kaydet";
    return <div className={`job-save${compact ? " is-compact" : ""}`}>
        <button type="button" className={`job-save-button${saved ? " is-saved" : ""}`} aria-label={`${job.title}: ${label}`} title={label} aria-pressed={saved} disabled={busy} onClick={() => void toggle()}><Icon name={busy ? "refresh" : "bookmark"} size={20} />{!compact && <span>{label}</span>}</button>
        <span className="sr-only" role="status">{busy ? "İlan kaydediliyor" : saved ? "İlan kaydedildi" : "İlan kayıtlı değil"}</span>
        {error && <p className="job-save-error" role="alert">{error}</p>}
    </div>;
}

const listPositions = new Map<string, { window: number; pane: number }>();
function rememberPosition(search: JobsSearch) {
    listPositions.set(JSON.stringify(search), { window: window.scrollY, pane: document.querySelector(".jobs-results")?.scrollTop || 0 });
    if (listPositions.size > 30) listPositions.delete(listPositions.keys().next().value!);
}
function JobCard({ job, search, selected, now }: { job: Job; search: JobsSearch; selected?: boolean; now: number }) {
    return <article className={`job-card${selected ? " is-selected" : ""}`}>
        <Link to={`/jobs/${job.id}`} search={search as never} className="job-card-link" aria-current={selected ? "page" : undefined} onClick={() => rememberPosition(search)}>
            <CompanyTile /><div className="job-card-copy"><h2 title={job.title}>{job.title}</h2><p className="job-card-company">{job.company}</p>
                {job.location && <p className="job-card-location">{job.location}</p>}
                <p className="job-card-conditions">{modes[job.workMode]} <span aria-hidden="true">·</span> {types[job.employmentType]}</p>
                <AvailabilityBadge job={job} now={now} /><p className="job-card-date"><time dateTime={job.createdAt}>Oluşturuldu: {new Date(job.createdAt).toLocaleDateString("tr-TR")}</time>{job.deadline && <span>Son başvuru: {new Date(job.deadline).toLocaleDateString("tr-TR")}</span>}</p>
            </div>
        </Link><JobSave key={job.id} job={job} compact />
    </article>;
}

function JobFilters({ search, busy }: { search: JobsSearch; busy: boolean }) {
    const navigate = useNavigate(), dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const [draft, setDraft] = useState({ mode: search.mode, type: search.type });
    const count = Number(!!search.mode) + Number(!!search.type);
    const change = (patch: Partial<JobsSearch>) => navigate({ to: "/jobs", search: { ...search, ...patch, cursor: "", cursorHistory: [] } as never });
    function close() { dialog.current?.close(); trigger.current?.focus(); }
    return <>
        <div className="jobs-search-surface"><form className="jobs-primary-search" key={`${search.q}:${search.location}`} onSubmit={event => {
            event.preventDefault(); const form = new FormData(event.currentTarget);
            void change({ q: String(form.get("q") || "").trim(), location: String(form.get("location") || "").trim() });
        }}><label><span>İlan veya şirket</span><input name="q" maxLength={120} defaultValue={search.q} placeholder="Pozisyon, şirket…" /></label><label><span>Konum</span><input name="location" maxLength={120} defaultValue={search.location} placeholder="Şehir veya bölge" /></label><Button type="submit" aria-label="İlan ara" disabled={busy}><Icon name="search" size={18} /><span>Ara</span></Button></form>
            <button type="button" className="jobs-filter-trigger" ref={trigger} aria-label={`Filtreler${count ? `, ${count} filtre uygulandı` : ""}`} aria-haspopup="dialog" disabled={busy} onClick={() => { setDraft({ mode: search.mode, type: search.type }); dialog.current?.showModal(); }}><Icon name="settings" size={18} /><span className="jobs-filter-label">Filtreler</span>{count > 0 && <span className="jobs-filter-count">{count}</span>}</button>
        </div>
        {(search.q || search.location || count > 0) && <div className="jobs-applied" aria-label="Uygulanan filtreler">
            {([["q", search.q], ["location", search.location], ["mode", modes[search.mode as keyof typeof modes]], ["type", types[search.type as keyof typeof types]]] as const).filter(([, label]) => !!label).map(([key, label]) => <button key={key} type="button" disabled={busy} onClick={() => void change({ [key]: "" })} aria-label={`${label} filtresini kaldır`}>{label}<Icon name="close" size={14} /></button>)}
            <button type="button" className="jobs-clear" disabled={busy} onClick={() => void change({ q: "", location: "", mode: "", type: "" })}>Temizle</button>
        </div>}
        <dialog ref={dialog} className="jobs-filter-dialog" aria-labelledby="jobs-filter-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}>
            <form onSubmit={event => { event.preventDefault(); close(); void change(draft); }}><header><h2 id="jobs-filter-title">İlan filtreleri</h2><button type="button" aria-label="Filtreleri kapat" onClick={close}><Icon name="close" size={20} /></button></header><div className="jobs-filter-body feature-form">
                <p>Çalışmak istediğin koşulları seç. Uygula dediğinde sonuçlar yenilenir.</p>
                <label>Çalışma şekli<select value={draft.mode} onChange={event => setDraft(value => ({ ...value, mode: event.target.value }))}><option value="">Tüm çalışma şekilleri</option>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>İstihdam türü<select value={draft.type} onChange={event => setDraft(value => ({ ...value, type: event.target.value }))}><option value="">Tüm türler</option>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div><footer><Button variant="outline" type="button" onClick={close}>Vazgeç</Button><Button type="submit">Uygula</Button></footer></form>
        </dialog>
    </>;
}
function JobsEmpty({ search }: { search: JobsSearch }) {
    const filtered = !!(search.q || search.location || search.mode || search.type || search.cursor);
    const title = filtered ? "Bu aramada ilan bulunamadı" : search.filter === "saved" ? "Henüz kaydettiğin ilan yok" : search.filter === "mine" ? "İlk ilanını oluştur" : "Henüz iş ilanı yok";
    const description = filtered ? "Aramanı sadeleştirerek veya filtreleri kaldırarak tekrar deneyebilirsin." : search.filter === "saved" ? "İlgini çeken ilanları kaydet, buradan kolayca geri dön." : search.filter === "mine" ? "Bir fırsatı toplulukla paylaşmak için taslak hazırlayabilirsin." : "Üyeler yeni fırsatlar paylaştığında burada görünecek.";
    return <StatePanel title={title} description={description} kind="no-results" action={filtered ? <Button variant="outline" asChild><Link to="/jobs" search={{ filter: search.filter } as never}>Filtreleri temizle</Link></Button> : search.filter === "saved" ? <Button variant="outline" asChild><Link to="/jobs" search={{ filter: "all" } as never}>İlanları keşfet</Link></Button> : <Button asChild><Link to="/jobs/new" search={search as never}>İlan oluştur</Link></Button>} />;
}
function JobsPagination({ data, search, busy }: { data: ResourcePage<Job>; search: JobsSearch; busy: boolean }) {
    const navigate = useNavigate(), history = search.cursorHistory || [];
    if (!search.cursor && !data.nextCursor) return null;
    return <nav className="feature-pagination" aria-label="İlan sayfaları"><Button variant="outline" disabled={busy || !search.cursor} onClick={() => void navigate({ to: "/jobs", search: { ...search, cursor: history.at(-1) || "", cursorHistory: history.slice(0, -1) } as never })}>Önceki</Button><Button variant="outline" disabled={busy || !data.nextCursor} onClick={() => void navigate({ to: "/jobs", search: { ...search, cursor: data.nextCursor || "", cursorHistory: [...history, search.cursor || ""].slice(-20) } as never })}>Sonraki</Button></nav>;
}
function JobsWorkspace({ data, job, listError = "", retryList }: { data: ResourcePage<Job> | null; job?: Job; listError?: string; retryList?: () => void }) {
    const search = useSearch({ strict: false }) as JobsSearch, now = useAvailabilityTime();
    const busy = useContentLoading(), showLoading = useDelayedLoading(busy);
    const key = JSON.stringify(search), results = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const position = listPositions.get(key);
        if (position && results.current) { results.current.scrollTop = position.pane; if (!job) window.scrollTo({ top: position.window }); }
        if (job && !window.matchMedia("(min-width: 1051px)").matches) window.scrollTo({ top: 0 });
    }, [key, job?.id]);
    return <section className={`feature-page jobs-page${job ? " has-selection" : ""}`}>
        <div className="jobs-board-chrome"><header className="feature-heading jobs-heading"><div>{job ? <h2>İş ilanları</h2> : <h1>İş ilanları</h1>}<p>Topluluktan yeni kariyer fırsatları.</p></div><Button asChild><Link to="/jobs/new" search={search as never}>İlan oluştur</Link></Button></header>
            <nav className="jobs-views" aria-label="İlan görünümü">{Object.entries(views).map(([value, label]) => <Link key={value} to="/jobs" search={{ ...search, filter: value, cursor: "", cursorHistory: [] } as never} aria-current={search.filter === value ? "page" : undefined}>{label}</Link>)}</nav>
            <JobFilters search={search} busy={busy} />
        </div>
        <div className="jobs-workspace"><div className="jobs-results" ref={results} aria-busy={busy} onScroll={() => rememberPosition(search)}>
            <div className="jobs-results-label"><h2>{views[search.filter as keyof typeof views]}</h2><span>En yeni oluşturulan ilanlar</span></div>
            {showLoading && <div className="jobs-results-loading"><LoadingSpinner label="İlanlar güncelleniyor" /></div>}
            {listError ? <div className="jobs-list-error"><p role="alert">{listError}</p><Button variant="outline" onClick={retryList}>Tekrar dene</Button></div> : data ? <><div className="jobs-card-list">{data.items.map(item => <JobCard key={item.id} job={item} search={search} selected={job?.id === item.id} now={now} />)}</div>{!data.items.length && !busy && <JobsEmpty search={search} />}<JobsPagination data={data} search={search} busy={busy} /></> : <LoadingSpinner label="İlan listesi yükleniyor" />}
        </div><div className="jobs-detail-pane" aria-busy={busy}>{job ? <JobDetail key={job.id} job={job} search={search} now={now} /> : <div className="jobs-select-prompt"><StatePanel title="Bir sonraki adımını keşfet" description="Bir ilan seç; çalışma koşulları ve başvuru bilgileri burada açılsın." kind="empty" /><p>Başvurular ilgili şirketin dış sitesinde yapılır.</p></div>}</div></div>
    </section>;
}
export function JobsPage() { return <JobsWorkspace data={useLoaderData({ strict: false }) as ResourcePage<Job>} />; }
export function JobDetailPage() {
    const data = useLoaderData({ strict: false }) as JobDetailData;
    const search = useSearch({ strict: false }) as JobsSearch;
    return <DetailWorkspace key={JSON.stringify(search)} data={data} search={search} />;
}
function DetailWorkspace({ data, search }: { data: JobDetailData; search: JobsSearch }) {
    const [list, setList] = useState(data.list), [error, setError] = useState(data.listError);
    const router = useRouter();
    useEffect(() => { if (data.list) setList(data.list); setError(data.listError); }, [data.list, data.listError]);
    useEffect(() => {
        const media = window.matchMedia("(min-width: 1051px)");
        let active = true, requested = false;
        const update = () => {
            if (!media.matches || list || error || requested) return;
            requested = true;
            void loadJobs(search).then(value => { if (active) setList(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "İlan listesi yüklenemedi."); });
        };
        update(); media.addEventListener("change", update);
        return () => { active = false; media.removeEventListener("change", update); };
    }, [list, error, search]);
    return <JobsWorkspace data={list} job={data.job} listError={error} retryList={() => { invalidateApiCache(); setError(""); void router.invalidate(); }} />;
}

function JobSummary({ job, now, actions, heading = "h1" }: { job: Pick<Job, "title" | "company" | "location" | "workMode" | "employmentType" | "deadline" | "status" | "applicationUrl">; now: number; actions?: ReactNode; heading?: "h1" | "h2" }) {
    const Heading = heading;
    return <div className="job-summary"><div className="job-summary-heading"><CompanyTile /><div><Heading>{job.title || "İlan başlığı"}</Heading><p className="job-summary-company">{job.company || "Şirket"}</p>{job.location && <p className="job-card-location">{job.location}</p>}</div></div>
        <div className="job-summary-conditions"><span>{modes[job.workMode]}</span><span>{types[job.employmentType]}</span><AvailabilityBadge job={job} now={now} /></div>
        {job.deadline && <p className="job-deadline"><Icon name="calendar" size={16} />Son başvuru: <time dateTime={job.deadline}>{new Date(job.deadline).toLocaleString("tr-TR")}</time></p>}
        {actions && <div className="job-applicant-actions">{actions}</div>}
        <p className="feature-note job-destination">Başvuru sitesi: <strong>{externalDomain(job.applicationUrl) || "Geçerli bir HTTPS bağlantısı gerekli"}</strong>. Dış siteye geçiş başvuru göndermez.</p>
    </div>;
}
function JobDetail({ job, search, now }: { job: Job; search: JobsSearch; now: number }) {
    const { profile } = useMe(), router = useRouter(), navigate = useNavigate();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const pending = useRef(false);
    const owner = profile.id === job.ownerId, state = availability(job, now), destination = safeExternal(job.applicationUrl);
    async function manage(action: "delete" | "published" | "closed") {
        if (pending.current) return;
        if (action === "delete" && !window.confirm("İlan kalıcı olarak silinsin mi?")) return;
        pending.current = true; setBusy(true); setError("");
        try {
            if (action === "delete") { await api(`/jobs/${job.id}`, "DELETE"); await navigate({ to: "/jobs", search: search as never }); }
            else { await api(`/jobs/${job.id}`, "PATCH", { ...job, status: action, version: job.version }); await router.invalidate(); }
        } catch (cause) { setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı."); }
        finally { pending.current = false; setBusy(false); }
    }
    return <article className="job-detail"><Link to="/jobs" search={search as never} className="job-back"><Icon name="back" size={18} />İlanlara dön</Link>
        <JobSummary job={job} now={now} actions={<>
            {state.canApply && destination ? <Button asChild><a href={destination} target="_blank" rel="noopener noreferrer">Dış sitede başvur<Icon name="share" size={17} /></a></Button> : <Button disabled>{state.kind === "expired" ? "Başvuru süresi doldu" : !destination && state.canApply ? "Başvuru bağlantısı kullanılamıyor" : state.kind === "draft" ? "Henüz yayınlanmadı" : "Başvuru kapalı"}</Button>}
            <JobSave job={job} />{job.status === "published" && <Button asChild variant="outline"><Link to="/" search={{ shareJob: job.id } as never}>Gönderi olarak paylaş</Link></Button>}{job.status === "published" && <ShareMenu url={`${location.origin}/jobs/${encodeURIComponent(job.id)}`} title={`${job.title} · ${job.company}`} label="İlanı paylaş" className="job-share" />}
        </>} />
        <section className="job-description"><h2>İlan hakkında</h2><p className="feature-body">{job.description}</p></section>
        <footer className="job-publisher"><Icon name="user" size={20} /><div><span>Üye tarafından paylaşıldı</span><Link to={`/profile/${job.publisher.id}`}>{job.publisher.name}</Link><time dateTime={job.createdAt}>Oluşturuldu: {new Date(job.createdAt).toLocaleDateString("tr-TR")}</time></div></footer>
        {owner && <section className="job-management"><h2>İlanı yönet</h2><p>İlanın görünürlüğünü ve içeriğini buradan düzenleyebilirsin.</p><ErrorMessage message={error} /><div className="feature-actions"><Button asChild variant="outline"><Link to={`/jobs/${job.id}/edit`} search={search as never}>Düzenle</Link></Button>{job.status === "draft" && <Button disabled={busy} onClick={() => void manage("published")}>{busy ? "İşleniyor…" : "Yayınla"}</Button>}{job.status === "published" && <Button variant="outline" disabled={busy} onClick={() => void manage("closed")}>İlanı kapat</Button>}<Button className="job-delete" variant="outline" disabled={busy} onClick={() => void manage("delete")}><Icon name="delete" size={17} />Sil</Button></div></section>}
    </article>;
}
export function JobRouteError({ error, reset }: { error: unknown; reset?: () => void }) {
    const router = useRouter();
    const raw = router.state.location.search as Record<string, unknown>;
    const search = { ...jobSearch(raw), cursor: typeof raw.cursor === "string" ? raw.cursor.slice(0, 1024) : "", cursorHistory: Array.isArray(raw.cursorHistory) ? raw.cursorHistory.filter((value): value is string => typeof value === "string" && value.length <= 1024).slice(-20) : [] };
    const retry = async () => { invalidateApiCache(); await router.invalidate(); reset?.(); };
    if (router.state.location.pathname === "/jobs") return <JobsWorkspace data={null} listError={error instanceof Error ? error.message : "İlanlar yüklenemedi. Tekrar deneyebilirsin."} retryList={() => void retry()} />;
    return <ErrorScreen error={error} retry={retry} home={<Button variant="outline" asChild><Link to="/jobs" search={search as never}>İlanlara dön</Link></Button>} />;
}

export function JobFormPage({ edit = false }: { edit?: boolean }) {
    const data = useLoaderData({ strict: false }) as Job | undefined;
    const { profile } = useMe(), search = useSearch({ strict: false }) as JobsSearch;
    if (edit && data && data.ownerId !== profile.id) return <section className="feature-page"><StatePanel title="Bu ilanı düzenleyemezsin" description="Yalnızca ilanı paylaşan üye değişiklik yapabilir." kind="no-results" action={<Button asChild variant="outline"><Link to={`/jobs/${data.id}`} search={search as never}>İlana dön</Link></Button>} /></section>;
    return <JobEditor key={edit ? data?.id : "new"} job={edit ? data : undefined} />;
}
function JobEditor({ job }: { job?: Job }) {
    const initial = { title: job?.title || "", company: job?.company || "", location: job?.location || "", description: job?.description || "", workMode: job?.workMode || "remote", employmentType: job?.employmentType || "full-time", applicationUrl: job?.applicationUrl || "", deadline: localInput(job?.deadline) };
    const [values, setValues] = useState(initial), [error, setError] = useState(""), [busy, setBusy] = useState(false), [preview, setPreview] = useState(false), [urlError, setUrlError] = useState("");
    const guard = useFormGuard(values, initial), navigate = useNavigate(), search = useSearch({ strict: false }) as JobsSearch, pending = useRef(false), urlInput = useRef<HTMLInputElement>(null), previewRef = useRef<HTMLElement>(null);
    const now = useAvailabilityTime();
    const update = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
    async function save(event: FormEvent) {
        event.preventDefault();
        if (pending.current) return;
        if (!safeExternal(values.applicationUrl)) { setUrlError("Kullanıcı adı veya parola içermeyen geçerli bir HTTPS bağlantısı gir."); urlInput.current?.focus(); return; }
        pending.current = true; setBusy(true); setError(""); setUrlError("");
        try {
            const saved = await api<Job>(job ? `/jobs/${job.id}` : "/jobs", job ? "PATCH" : "POST", { ...values, deadline: utcInput(values.deadline), status: job?.status || "draft", version: job?.version });
            guard.commit(); await navigate({ to: `/jobs/${saved.id}`, search: search as never });
        } catch (cause) { setError(cause instanceof Error ? cause.message : "İlan kaydedilemedi."); }
        finally { pending.current = false; setBusy(false); }
    }
    return <section className="feature-page job-editor-page"><header className="feature-heading"><div><h1>{job ? "İlanı düzenle" : "Yeni iş ilanı"}</h1><p>Taslağını kaydet, kontrol et ve hazır olduğunda yayınla.</p></div></header><form className="feature-form job-editor" onSubmit={save}>
        <fieldset><legend>Pozisyon ve şirket</legend><p>İlanın temel bilgilerini kısa ve açık tut.</p>{([["title", "İlan başlığı", 120], ["company", "Şirket", 120], ["location", "Konum (isteğe bağlı)", 120]] as const).map(([key, label, max]) => <label key={key}>{label}<input required={key !== "location"} maxLength={max} value={values[key]} onChange={event => update(key, event.target.value)} /></label>)}</fieldset>
        <fieldset><legend>Çalışma koşulları</legend><div className="feature-form-grid"><label>Çalışma şekli<select value={values.workMode} onChange={event => update("workMode", event.target.value as Job["workMode"])}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>İstihdam türü<select value={values.employmentType} onChange={event => update("employmentType", event.target.value as Job["employmentType"])}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></fieldset>
        <fieldset><legend>İlan açıklaması</legend><p>Rolü, beklenen deneyimi ve çalışma koşullarını anlat.</p><label>Açıklama<textarea required rows={10} maxLength={20000} value={values.description} onChange={event => update("description", event.target.value)} /></label></fieldset>
        <fieldset><legend>Başvuru bilgileri</legend><p>Başvurular dış sitede yapılır. Bu sayfa başvuru toplamaz.</p><label>HTTPS başvuru bağlantısı<input ref={urlInput} required type="url" maxLength={2048} placeholder="https://" aria-invalid={!!urlError} aria-describedby={urlError ? "job-url-error" : undefined} value={values.applicationUrl} onChange={event => { update("applicationUrl", event.target.value); setUrlError(""); }} />{urlError && <span id="job-url-error" className="feature-error" role="alert">{urlError}</span>}</label><label>Son başvuru zamanı (isteğe bağlı)<input type="datetime-local" value={values.deadline} onChange={event => update("deadline", event.target.value)} /></label></fieldset>
        <ErrorMessage message={error} /><div className="feature-actions"><Button disabled={busy} type="submit">{busy ? "Kaydediliyor…" : job ? "Değişiklikleri kaydet" : "Taslağı kaydet"}</Button><Button type="button" variant="outline" aria-expanded={preview} aria-controls="job-preview" onClick={() => { setPreview(value => !value); if (!preview) requestAnimationFrame(() => previewRef.current?.focus()); }}>{preview ? "Önizlemeyi kapat" : "Önizleme"}</Button><Link className="job-cancel" to={job ? `/jobs/${job.id}` : "/jobs"} search={search as never}>Vazgeç</Link></div>
    </form>{preview && <section id="job-preview" ref={previewRef} tabIndex={-1} className="job-preview"><p className="job-preview-label">Önizleme · Henüz kaydedilmemiş değişiklikler</p><JobSummary heading="h2" job={{ ...values, status: job?.status || "draft", deadline: utcInput(values.deadline), workMode: values.workMode as Job["workMode"], employmentType: values.employmentType as Job["employmentType"] }} now={now} /><section className="job-description"><h2>İlan hakkında</h2><p className="feature-body">{values.description || "İlan açıklaması burada görünecek."}</p></section></section>}</section>;
}
