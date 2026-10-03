import { isRedirect, Link, useLoaderData, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AccountList, AccountListsPage, Profile, ProfileListPage, SearchResults, TimelinePage } from "../../shared/types";
import { Avatar } from "../ui";
import { Icon } from "../components/icon";
import { api, invalidateApiCache } from "../lib/api";
import { Button } from "../components/ui/button";
import { StatePanel } from "../components/page-state";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import { TimelineList } from "../components/timeline-list";
import { useBlocker } from "@tanstack/react-router";
import { FeatureEmpty, FeatureHeader } from "../components/feature-presentation";
import "../components/lists.css";

type ListSearch = { tab?: "posts" | "members"; cursor?: string; cursorHistory?: string[]; snapshot?: string };
type ListContent = { list: AccountList; timeline?: TimelinePage; members?: ProfileListPage };
type ListTab = "posts" | "members";

export async function loadLists(cursor = ""): Promise<AccountListsPage> {
  return api<AccountListsPage>(`/lists${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export async function loadList(id: string): Promise<AccountList> {
  return api<AccountList>(`/lists/${encodeURIComponent(id)}`);
}

export async function loadListTimeline(id: string, cursor = "", snapshot = ""): Promise<TimelinePage> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  if (snapshot) query.set("snapshot", snapshot);
  return api<TimelinePage>(`/lists/${encodeURIComponent(id)}/timeline${query.size ? `?${query}` : ""}`);
}

export async function loadListMembers(id: string, cursor = ""): Promise<ProfileListPage> {
  return api<ProfileListPage>(`/lists/${encodeURIComponent(id)}/members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export async function loadListContent(id: string, search: ListSearch = {}): Promise<ListContent> {
  const list = await loadList(id);
  const tab = search.tab === "members" ? "members" : "posts";
  if (tab === "members") return { list, members: await loadListMembers(id, search.cursor || "") };
  return { list, timeline: await loadListTimeline(id, search.cursor || "", search.snapshot || "") };
}

export function ListsPage() {
  const data = useLoaderData({ strict: false }) as AccountListsPage;
  const search = useSearch({ strict: false }) as ListSearch;
  const navigate = useNavigate();
  const loading = useContentLoading();
  const showLoading = useDelayedLoading(loading);
  const cursor = search.cursor || "";
  const history = cleanHistory(search.cursorHistory);
  const goTo = (next: string, nextHistory: string[]) => void navigate({ to: "/lists", search: { cursor: next, cursorHistory: nextHistory } as never });

  return <main className="feature-page lists-page">
    <FeatureHeader className="lists-heading" title="Listelerin" eyebrow="ÖZEL KÜTÜPHANE" description="Seçtiğin kişilerin gönderilerini ayrı bir akışta takip et." action={<Button asChild><Link to="/lists/new">Yeni liste</Link></Button>} />
    <p className="lists-private-note">Listelerini yalnızca sen görebilirsin. Liste üyeliği, kişiyi takip etmeni değiştirmez.</p>
    <div className="feature-results" aria-busy={loading}>
    {showLoading ? <LoadingSpinner label="Listelerin yükleniyor"/> : data.lists.length ? <div className="lists-library">{data.lists.map(list => <article className="lists-library-card" key={list.id}>
      <Link className="lists-library-main" to={`/lists/${list.id}`}>
        <span className="lists-lock"><Icon name="hide" size={20} /></span><span className="lists-library-copy"><strong>{list.name}</strong><small>{list.memberCount} kişi</small>{list.description && <span>{list.description}</span>}</span>
      </Link>
      <Link className="lists-edit-link" to={`/lists/${list.id}/edit`}>Düzenle</Link>
    </article>)}</div> : <FeatureEmpty title={cursor ? "Bu sayfada liste yok" : "Henüz listen yok"} description={cursor ? "Listelerinin ilk sayfasına dönerek kayıtlarını görüntüleyebilirsin." : "İlgi duyduğun kişileri özel listelerde toplayabilir, gönderilerini ayrı bir akışta görebilirsin."} icon={<Icon name="list" size={24}/>} action={cursor ? <Button variant="outline" disabled={loading} onClick={() => goTo("", [])}>İlk sayfaya dön</Button> : <Button asChild><Link to="/lists/new">İlk listeni oluştur</Link></Button>} />}
    </div>
    {(cursor || data.nextCursor) && <nav className="lists-pagination" aria-label="Listeler sayfaları">
      {history.length ? <Button variant="outline" disabled={loading} onClick={() => goTo(history.at(-1) || "", history.slice(0, -1))}>Önceki</Button> : cursor ? <Button variant="outline" disabled={loading} onClick={() => goTo("", [])}>İlk sayfa</Button> : <span />}
      <Button variant="outline" disabled={loading || !data.nextCursor} onClick={() => data.nextCursor && goTo(data.nextCursor, [...history, cursor].slice(-20))}>Sonraki</Button>
    </nav>}
  </main>;
}

export function ListFormPage({ mode }: { mode: "create" | "edit" }) {
  const loaderData = useLoaderData({ strict: false }) as AccountList | undefined;
  const existing = mode === "edit" ? loaderData || null : null;
  return <ListFormEditor key={`${mode}:${existing?.id || "new"}`} mode={mode} existing={existing} />;
}

function ListFormEditor({ mode, existing }: { mode: "create" | "edit"; existing: AccountList | null }) {
  const navigate = useNavigate();
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const original = useRef({ name: existing?.name || "", description: existing?.description || "" });
  const values = useRef({ name: existing?.name || "", description: existing?.description || "" });
  const committed = useRef(false);
  function hasUnsavedChanges() {
    return !committed.current && (values.current.name !== original.current.name || values.current.description !== original.current.description);
  }
  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (current.pathname === next.pathname || !hasUnsavedChanges()) return false;
      return !window.confirm("Kaydedilmemiş değişiklikler silinsin mi?");
    },
    enableBeforeUnload: hasUnsavedChanges,
  });
  useEffect(() => {
    if (!existing || committed.current) return;
    original.current = { name: existing.name, description: existing.description };
    values.current = { name: existing.name, description: existing.description };
    setName(existing.name); setDescription(existing.description);
  }, [existing?.id, existing?.name, existing?.description]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = { name: name.trim(), description: description.trim() };
      const saved = mode === "create"
        ? await api<AccountList>("/lists", "POST", payload)
        : await api<AccountList>(`/lists/${encodeURIComponent(existing!.id)}`, "PATCH", payload);
      original.current = { name: saved.name, description: saved.description };
      values.current = { name: saved.name, description: saved.description };
      committed.current = true;
      setName(saved.name); setDescription(saved.description);
      invalidateApiCache();
      await navigate({ to: `/lists/${saved.id}` as never });
    } catch (cause) {
      if (isRedirect(cause)) { await navigate({ to: "/sign-in" }); return; }
      setError(errorMessage(cause));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!existing || busy || !window.confirm(`“${existing.name}” listesini ve üyeliklerini silmek istiyor musun?`)) return;
    setBusy(true); setError("");
    try {
      await api(`/lists/${encodeURIComponent(existing.id)}`, "DELETE");
      original.current = { name, description };
      committed.current = true;
      invalidateApiCache();
      await navigate({ to: "/lists" });
    } catch (cause) {
      if (isRedirect(cause)) { await navigate({ to: "/sign-in" }); return; }
      setError(errorMessage(cause));
    } finally { setBusy(false); }
  }

  return <main className="feature-page lists-page lists-form-page">
    <FeatureHeader className="lists-heading" title={mode === "create" ? "Yeni liste oluştur" : "Listeyi düzenle"} eyebrow="ÖZEL LİSTE" description="Bu listeyi ve üyelerini yalnızca sen görebilirsin." />
    <form className="lists-form" onSubmit={submit}>
      <label htmlFor="list-name">Liste adı</label>
      <input id="list-name" name="name" autoComplete="off" maxLength={80} minLength={1} required value={name} onChange={event => { values.current = { ...values.current, name: event.target.value }; setName(event.target.value); }} aria-describedby="list-name-count" />
      <small id="list-name-count" className="lists-field-count">{name.length}/80</small>
      <label htmlFor="list-description">Açıklama <span>(isteğe bağlı)</span></label>
      <textarea id="list-description" name="description" maxLength={350} rows={4} value={description} onChange={event => { values.current = { ...values.current, description: event.target.value }; setDescription(event.target.value); }} aria-describedby="list-description-count" />
      <small id="list-description-count" className="lists-field-count">{description.length}/350</small>
      <p className="lists-private-note">Listeye kişi eklemek veya listeden çıkarmak, takip ilişkini değiştirmez. Akışta yalnızca kişilerin kendi gönderileri ve yeniden paylaşımları yer alır; topluluk gönderileri ve yanıtlar dahil değildir.</p>
      {error && <p className="lists-form-error" role="alert">{error}</p>}
      <div className="lists-form-actions"><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Kaydediliyor…" : mode === "create" ? "Liste oluştur" : "Değişiklikleri kaydet"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void navigate({ to: mode === "edit" && existing ? `/lists/${existing.id}` as never : "/lists" })}>Vazgeç</Button></div>
    </form>
    {mode === "edit" && <section className="lists-delete"><h2>Listeyi sil</h2><p>Liste ve üye kayıtları kalıcı olarak kaldırılır.</p><Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "İşleniyor…" : "Listeyi sil"}</Button></section>}
  </main>;
}

export function ListDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const data = useLoaderData({ strict: false }) as ListContent;
  const search = useSearch({ strict: false }) as ListSearch;
  const navigate = useNavigate();
  const router = useRouter();
  const loading = useContentLoading();
  const tab: ListTab = search.tab === "members" ? "members" : "posts";
  const tabsId = useId();
  const tabRefs = useRef<Record<ListTab, HTMLButtonElement | null>>({ posts: null, members: null });
  const cursor = search.cursor || "";
  const history = cleanHistory(search.cursorHistory);
  const [mutationError, setMutationError] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const mutationLock = useRef(false);
  const goTo = (next: string, nextHistory: string[], nextTab = tab, snapshot = "") => void navigate({ to: `/lists/${id}` as never, search: { tab: nextTab, cursor: next, cursorHistory: nextHistory, snapshot } as never });
  const setTab = (nextTab: ListTab) => goTo("", [], nextTab, "");
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: ListTab) {
    const next: ListTab | null = event.key === "Home" ? "posts" : event.key === "End" ? "members" : ["ArrowLeft", "ArrowRight"].includes(event.key) ? current === "posts" ? "members" : "posts" : null;
    if (!next) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    if (next !== tab) setTab(next);
  }

  async function mutateMember(profileId: string, add: boolean) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setMutationBusy(true); setMutationError("");
    try {
      await api(`/lists/${encodeURIComponent(id)}/members/${encodeURIComponent(profileId)}`, add ? "PUT" : "DELETE", add ? {} : undefined);
      invalidateApiCache();
      await navigate({ to: `/lists/${id}` as never, search: { tab: "members", cursor: "", cursorHistory: [], snapshot: "" } as never });
      await router.invalidate();
    } catch (cause) {
      if (isRedirect(cause)) { await navigate({ to: "/sign-in" }); return; }
      setMutationError(errorMessage(cause));
    } finally { mutationLock.current = false; setMutationBusy(false); }
  }

  const membersData = data.members;
  const memberIds = new Set(membersData?.profiles.map(profile => profile.id) || []);
  return <main className="feature-page lists-page lists-detail-page">
    <Link className="lists-back-link" to="/lists">‹ Listelerin</Link>
    <FeatureHeader className="lists-heading lists-detail-heading" title={data.list.name} eyebrow={`ÖZEL LİSTE · ${data.list.memberCount} KİŞİ`} description={data.list.description || undefined} action={<Button variant="outline" asChild><Link to={`/lists/${id}/edit`}>Düzenle</Link></Button>}/>
    <p className="lists-private-note">Bu listeyi yalnızca sen görebilirsin. Üyelik, takip ilişkini değiştirmez.</p>
    <div className="lists-tabs" role="tablist" aria-label={`${data.list.name} listesi`}>
      <button ref={element => { tabRefs.current.posts = element; }} id={`${tabsId}-posts`} type="button" role="tab" tabIndex={tab === "posts" ? 0 : -1} aria-controls={`${tabsId}-panel`} aria-selected={tab === "posts"} onKeyDown={event => onTabKeyDown(event, "posts")} onClick={() => setTab("posts")}>Gönderiler</button>
      <button ref={element => { tabRefs.current.members = element; }} id={`${tabsId}-members`} type="button" role="tab" tabIndex={tab === "members" ? 0 : -1} aria-controls={`${tabsId}-panel`} aria-selected={tab === "members"} onKeyDown={event => onTabKeyDown(event, "members")} onClick={() => setTab("members")}>Üyeler <span>{data.list.memberCount}</span></button>
    </div>
    {tab === "posts" ? <section id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-posts`} tabIndex={0} className="lists-tab-panel" aria-busy={loading}>
      <p className="lists-context">Bu akış, listedeki kişilerin kişisel gönderilerini ve yeniden paylaşımlarını gösterir. Topluluk gönderileri ve yanıtlar bu listeye dahil değildir.</p>
      {data.timeline ? <TimelineList data={data.timeline} /> : loading ? <LoadingSpinner /> : <StatePanel kind="server-down" title="Akış yüklenemedi" description="Liste gönderilerini yeniden yükle." action={<Button variant="outline" onClick={() => void router.invalidate()}>Tekrar dene</Button>} />}
    </section> : <section id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-members`} tabIndex={0} className="lists-tab-panel" aria-busy={loading}>
      <MemberPicker onAdd={profile => void mutateMember(profile.id, true)} disabled={mutationBusy} memberIds={memberIds} />
      {mutationError && <div className="lists-member-error" role="alert"><span>{mutationError}</span><Button variant="outline" disabled={mutationBusy} onClick={() => void router.invalidate()}>Yeniden yükle</Button></div>}
      {membersData?.profiles.length ? <div className="lists-members">{membersData.profiles.map(profile => <MemberRow key={profile.id} profile={profile} pending={mutationBusy} onRemove={() => void mutateMember(profile.id, false)} />)}</div> : loading ? <LoadingSpinner /> : <StatePanel kind="empty" title={cursor ? "Bu sayfada üye yok" : "Listende henüz kimse yok"} description={cursor ? "Listenin ilk sayfasına dönerek üyeleri görüntüleyebilirsin." : "Aramayla kişi bulup listeye ekleyebilirsin. Üyelik takip ilişkini değiştirmez."} action={cursor ? <Button variant="outline" onClick={() => goTo("", [], "members")}>İlk sayfaya dön</Button> : undefined} />}
      <ListPagination cursor={cursor} history={history} nextCursor={membersData?.nextCursor || null} loading={loading || mutationBusy} goTo={goTo} tab="members" />
    </section>}
  </main>;
}

function ListPagination({ cursor, history, nextCursor, loading, goTo, tab }: { cursor: string; history: string[]; nextCursor: string | null; loading: boolean; goTo: (cursor: string, history: string[], tab?: ListTab, snapshot?: string) => void; tab: ListTab }) {
  if (!cursor && !nextCursor) return null;
  return <nav className="lists-pagination" aria-label="Liste sayfaları">
    {history.length ? <Button variant="outline" disabled={loading} onClick={() => goTo(history.at(-1) || "", history.slice(0, -1), tab)}>Önceki</Button> : cursor ? <Button variant="outline" disabled={loading} onClick={() => goTo("", [], tab)}>İlk sayfa</Button> : <span />}
    <Button variant="outline" disabled={loading || !nextCursor} onClick={() => nextCursor && goTo(nextCursor, [...history, cursor].slice(-20), tab)}>Sonraki</Button>
  </nav>;
}

function MemberPicker({ onAdd, disabled, memberIds }: { onAdd: (profile: Profile) => void; disabled: boolean; memberIds: Set<string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef(0);
  const formId = useId();
  const box = useRef<HTMLDivElement>(null);
  const candidates = (results || []).filter(profile => !memberIds.has(profile.id)).slice(0, 8);
  useEffect(() => {
    const needle = query.trim();
    const requestId = ++request.current;
    setActive(-1);
    setResults(null);
    if (needle.length < 2) { setPending(false); setFailed(false); return; }
    let current = true;
    const timer = setTimeout(() => {
      setPending(true); setFailed(false);
      api<SearchResults>(`/search?q=${encodeURIComponent(needle)}`).then(value => {
        if (current && request.current === requestId) setResults(value.people);
      }).catch(() => { if (current && request.current === requestId) setFailed(true); }).finally(() => {
        if (current && request.current === requestId) setPending(false);
      });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  function choose(profile: Profile) { if (disabled) return; onAdd(profile); setQuery(""); setResults(null); setOpen(false); }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && candidates.length) { event.preventDefault(); setOpen(true); setActive(value => Math.min(value + 1, candidates.length - 1)); }
    if (event.key === "ArrowUp" && active >= 0) { event.preventDefault(); setActive(value => value - 1); }
    if (event.key === "Escape") { setOpen(false); setActive(-1); }
    if (event.key === "Enter" && open && active >= 0 && candidates[active]) { event.preventDefault(); choose(candidates[active]); }
  }
  return <div className="lists-picker" ref={box}>
    <label htmlFor={formId}>Kişi ekle</label>
    <div className="lists-picker-input-wrap"><input id={formId} type="search" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open && candidates.length > 0} aria-controls={`${formId}-options`} aria-activedescendant={active >= 0 ? `${formId}-option-${active}` : undefined} placeholder="İsim veya kullanıcı adı ara" value={query} disabled={disabled} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} onChange={event => { setResults(null); setQuery(event.target.value); setOpen(true); }} />{pending && <span role="status">Aranıyor…</span>}</div>
    {open && query.trim().length >= 2 && <div className="lists-picker-results" id={`${formId}-options`} role="listbox" aria-label="Arama sonuçları">
      {failed ? <p role="status">Arama yapılamadı. Tekrar denemek için yazmaya devam et.</p> : !pending && candidates.length === 0 && <p role="status">{results ? "Eşleşen yeni kişi bulunamadı." : "Sonuç bekleniyor…"}</p>}
      {candidates.slice(0, 8).map((profile, index) => <button type="button" role="option" aria-selected={active === index} id={`${formId}-option-${index}`} key={profile.id} disabled={disabled} onMouseEnter={() => setActive(index)} onClick={() => choose(profile)}><Avatar src={profile.image} name={profile.name} username={profile.username} /><span><strong>{profile.name}</strong><small>@{profile.username}</small></span><span className="lists-picker-add">Ekle</span></button>)}
    </div>}
  </div>;
}

function MemberRow({ profile, pending, onRemove }: { profile: Profile; pending: boolean; onRemove: () => void }) {
  return <article className="lists-member-row"><Link to={`/profile/${profile.id}`} className="lists-member-person"><Avatar src={profile.image} name={profile.name} username={profile.username} /><span><strong>{profile.name}</strong><small>@{profile.username}</small>{profile.bio && <small className="lists-member-bio">{profile.bio}</small>}</span></Link><Button type="button" variant="outline" disabled={pending} aria-label={`${profile.name}, listeden çıkar`} onClick={onRemove}>{pending ? "Bekle…" : "Çıkar"}</Button></article>;
}

function cleanHistory(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-20) : []; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene."; }
