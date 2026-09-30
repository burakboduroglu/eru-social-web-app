import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  Link,
  useLoaderData,
  useNavigate,
  useRouter,
  useSearch,
  useRouterState,
} from "@tanstack/react-router";
import type {
  Community,
  CommunityPage as CommunityData,
  CommunitySummary,
  FeedPage,
  Profile,
  ProfilePage as ProfileData,
  SearchResults,
  ThreadPage,
} from "../../shared/types";
import { api, invalidateApiCache } from "../lib/api";
import { uploadAvatar } from "../lib/supabase";
import {
  Avatar,
  Icon,
  Composer,
  Empty,
  ErrorNotice,
  Pagination,
  PostCard,
  PostList,
  useAction,
  useMe,
} from "../ui";

function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="x-icon-button"
      aria-label="Geri"
      onClick={() => {
        const index = (window.history.state as { idx?: number } | null)?.idx;
        if (typeof index === "number" && index > 0) router.history.back();
        else void navigate({ to: fallback });
      }}
    >
      <Icon name="back" size={20} />
    </button>
  );
}

function joinedLabel(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export function SearchForm({ initial = "" }: { initial?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [suggest, setSuggest] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const requestId = useRef(0);
  const listboxId = useId();
  const inputId = useId();
  useEffect(() => setValue(initial), [initial]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const needle = value.trim();
    const id = ++requestId.current;
    setActiveIndex(-1);
    if (needle.length < 2) {
      setSuggest(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    let live = true;
    setSuggest(null);
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(needle)}`).then(
        results => { if (live && requestId.current === id) { setSuggest(results); setLoading(false); } },
        () => { if (live && requestId.current === id) { setFailed(true); setLoading(false); } },
      );
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [value]);

  const suggestions = [
    ...(suggest?.people.slice(0, 3).map(person => ({
      kind: "person" as const,
      id: person.id,
      title: person.name,
      subtitle: `@${person.username}`,
      image: person.image,
      username: person.username,
      to: `/profile/${person.id}`,
    })) || []),
    ...(suggest?.communities.slice(0, 3).map(community => ({
      kind: "community" as const,
      id: community.id,
      title: community.name,
      subtitle: `${community.memberCount} üye`,
      image: community.image,
      username: community.username,
      to: `/communities/${community.id}`,
    })) || []),
  ];

  useEffect(() => {
    if (open && activeIndex >= 0 && suggestions[activeIndex]) {
      document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, listboxId, open, suggest]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
    setActiveIndex(-1);
    void navigate({ to: "/explore", search: { q: value.trim(), tab: "posts" } as never });
  }
  function go(to: string) {
    setOpen(false);
    setActiveIndex(-1);
    void navigate({ to } as never);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => index <= 0 ? suggestions.length - 1 : index - 1);
    } else if (event.key === "Enter" && showPanel && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      go(suggestions[activeIndex].to);
    }
  }
  function clear() {
    setValue(""); setSuggest(null); setOpen(false);
    setActiveIndex(-1);
    void navigate({ to: "/explore", search: { q: "", tab: "posts" } as never });
  }

  const showPanel = open && value.trim().length >= 2;
  return (
    <form
      ref={box}
      className="x-search-wrap"
      role="search"
      onSubmit={submit}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <div className="x-search">
        <Icon name="search" size={18} />
        <input
          id={inputId}
          name="q"
          value={value}
          onChange={event => { setValue(event.target.value); setOpen(true); }}
          onFocus={() => { if (value.trim().length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Ara"
          aria-label="Ara"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listboxId : undefined}
          aria-activedescendant={showPanel && activeIndex >= 0 && suggestions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
        />
        {value && (
          <button type="button" className="x-icon-button" aria-label="Aramayı temizle" onClick={clear}>
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {showPanel && (
        <div className="x-suggest-items">
          <div id={listboxId} role="listbox" aria-label="Arama önerileri">
            {suggestions.map((item, index) => (
              <div
                key={`${item.kind}-${item.id}`}
                id={`${listboxId}-option-${index}`}
                className="x-suggest-option"
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(item.to)}
              >
                <Avatar src={item.image} name={item.title} username={item.username} />
                <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                <small className="x-suggest-kind">{item.kind === "person" ? "Kişi" : "Topluluk"}</small>
              </div>
            ))}
          </div>
          {loading && <p className="x-suggest-state" role="status">Öneriler aranıyor…</p>}
          {failed && <p className="x-suggest-state" role="status">Öneriler yüklenemedi. Aramak için Enter'a bas.</p>}
          {!loading && !failed && suggest && !suggestions.length && (
            <p className="x-suggest-state" role="status">Öneri bulunamadı. Aramak için Enter'a bas.</p>
          )}
          <button type="submit" className="x-suggest-all">
            <Icon name="search" size={16} />
            <span>“{value.trim()}” için ara</span>
          </button>
        </div>
      )}
    </form>
  );
}

function AccountRow({ profile, detail }: { profile: Profile; detail?: string }) {
  return (
    <Link to={`/profile/${profile.id}`} className="x-account-row">
      <Avatar src={profile.image} name={profile.name} username={profile.username} />
      <span>
        <strong>{profile.name}</strong>
        <small>@{profile.username}</small>
        {detail && <p>{detail}</p>}
      </span>
    </Link>
  );
}
export function HomePage() {
  const data = useLoaderData({ strict: false }) as FeedPage;
  const me = useMe();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const search = useRouterState({ select: state => state.location.search }) as { feed?: string; snapshot?: string; page?: number };
  const navigate = useNavigate();

  async function refresh() {
    invalidateApiCache();
    setRefreshing(true);
    try {
      if (search.snapshot || search.page) await navigate({ to: "/", search: { feed: search.feed || "all", page: 0, snapshot: "" } as never, resetScroll: false });
      else await router.invalidate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col">
      <h1 className="sr-only">Ana Sayfa</h1>
      <nav className="x-feed-tabs" aria-label="Akış seçimi">
        <button className={search.feed !== "communities" ? "active" : ""} aria-pressed={search.feed !== "communities"} onClick={() => navigate({ to: "/", search: { feed: "all", page: 0 } as never, resetScroll: false })}>Senin için</button>
        <button className={search.feed === "communities" ? "active" : ""} aria-pressed={search.feed === "communities"} onClick={() => navigate({ to: "/", search: { feed: "communities", page: 0 } as never, resetScroll: false })}>Toplulukların</button>
        <button className="x-feed-refresh" aria-label="Akışı yenile" disabled={refreshing} onClick={refresh}><Icon name="refresh" size={20} /></button>
      </nav>
      <Composer communities={me.communities} />
      <PostList {...data} />
    </section>
  );
}

export function ThreadPageView() {
  const data = useLoaderData({ strict: false }) as ThreadPage;
  const me = useMe();
  const canReply =
    !data.post.communityId ||
    me.communities.some((community) => community.id === data.post.communityId);

  return (
    <section className="thread-page" aria-label="Gönderi ve yanıtları">
      <header className="x-bar">
        <BackButton fallback="/" />
        <h1>Gönderi</h1>
      </header>
      <PostCard post={data.post} detail />
      <div id="thread-reply" className="thread-reply">
        {canReply ? (
          <>
            <p className="thread-reply-target"><Link to={`/profile/${data.post.author.id}`}>@{data.post.author.username}</Link> adlı kişiye yanıt veriyorsun</p>
            <Composer parentId={data.post.id} />
          </>
        ) : (
          <p className="thread-reply-locked">Yanıtlamak için topluluğa katılmalısın.</p>
        )}
      </div>
      <section className="thread-replies" aria-labelledby="thread-replies-heading">
        <h2 id="thread-replies-heading" className="sr-only">Yanıtlar</h2>
        {data.replies.length || data.hasMore ? <PostList posts={data.replies} hasMore={data.hasMore} /> : <p className="thread-replies-empty">Henüz yanıt yok.</p>}
      </section>
    </section>
  );
}

export function ProfilePageView() {
  const data = useLoaderData({ strict: false }) as ProfileData;
  const me = useMe();
  const search = useRouterState({ select: state => state.location.search }) as {
    tab?: string;
    page?: number;
  };
  const navigate = useNavigate();
  const selectedTab = search.tab === "replies" ? "replies" : "posts";

  function selectTab(tab: string) {
    void navigate({
      search: { ...search, tab, page: 0 } as never,
      resetScroll: false,
    });
  }

  return (
    <section className="x-profile">
      <header className="x-bar">
        <BackButton fallback="/" />
        <div className="x-bar-titles"><h1>{data.profile.name}</h1><p>{data.postCount} gönderi</p></div>
      </header>
      <div className="x-cover" aria-hidden="true" />
      <div className="x-profile-actions">
        <Avatar src={data.profile.image} name={data.profile.name} username={data.profile.username} large />
        {data.profile.id === me.profile.id && <Link to="/profile/edit" className="x-pill-outline">Profili düzenle</Link>}
      </div>
      <div className="x-profile-copy">
        <h2>{data.profile.name}</h2>
        <p>@{data.profile.username}</p>
        {data.profile.bio && <p className="bio">{data.profile.bio}</p>}
        <p className="x-joined"><Icon name="calendar" size={14} /><span>{joinedLabel(data.profile.createdAt)} tarihinde katıldı</span></p>
      </div>
      <nav className="x-feed-tabs" aria-label="Profil sekmeleri">
        <button type="button" className={selectedTab === "posts" ? "active" : ""} aria-pressed={selectedTab === "posts"} onClick={() => selectTab("posts")}>Gönderiler</button>
        <button type="button" className={selectedTab === "replies" ? "active" : ""} aria-pressed={selectedTab === "replies"} onClick={() => selectTab("replies")}>Yanıtlar</button>
      </nav>
      <PostList posts={data.posts} hasMore={data.hasMore} />
    </section>
  );
}

export function ProfileEditor() {
  const { profile } = useMe();
  const navigate = useNavigate();
  const action = useAction();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.image || "");
  const [fileError, setFileError] = useState("");

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setFileError("");
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(profile.image || "");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarFile(null);
      setFileError("JPEG, PNG veya WebP biçiminde bir görsel seç.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFile(null);
      setFileError("Görsel boyutu en fazla 5 MB olabilir.");
      event.currentTarget.value = "";
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const success = await action.run(async () => {
      const image = avatarFile ? await uploadAvatar(avatarFile) : profile.image;
      await api("/me", "PATCH", {
        name: form.get("name"),
        username: form.get("username"),
        bio: form.get("bio"),
        image,
      });
    });
    if (success) await navigate({ to: `/profile/${profile.id}` });
  }

  const onboarding = !profile.onboarded;

  return (
    <section>
      <header className="x-bar">
        <BackButton fallback={onboarding ? "/onboarding" : `/profile/${profile.id}`} />
        <h1>{onboarding ? "Kendini tanıt" : "Profili düzenle"}</h1>
        <button type="submit" form="profile-editor" className="x-pill" disabled={action.busy}>
          {action.busy ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </header>
      <form id="profile-editor" onSubmit={submit}>
        <div className="x-cover" aria-hidden="true" />
        <div className="x-profile-actions">
          <label className="x-avatar-picker">
            <Avatar src={avatarPreview || undefined} name={profile.name || "Profil fotoğrafı"} username={profile.username} large />
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} aria-describedby="avatar-help" />
            <span><Icon name="camera" size={22} /><span className="sr-only">Fotoğrafı değiştir</span></span>
          </label>
        </div>
        <p id="avatar-help" className="x-field-note">JPEG, PNG veya WebP · en fazla 5 MB</p>
        {fileError && <p role="alert" className="x-field-note x-field-error">{fileError}</p>}
        <label className="x-field">
          <span>İsim</span>
          <input name="name" required minLength={3} maxLength={30} defaultValue={profile.name} autoComplete="name" />
        </label>
        <label className="x-field">
          <span>Kullanıcı adı</span>
          <input name="username" required pattern="[a-zA-Z0-9_]{3,30}" title="3–30 harf, rakam veya alt çizgi" defaultValue={profile.username || ""} autoComplete="username" />
        </label>
        <label className="x-field">
          <span>Hakkında</span>
          <textarea name="bio" maxLength={1000} defaultValue={profile.bio} rows={4} />
        </label>
        <ErrorNotice message={action.error} />
      </form>
    </section>
  );
}

export function ExplorePage() {
  const results = useLoaderData({ strict: false }) as SearchResults;
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string; tab?: string };
  const tab = search.tab === "people" || search.tab === "communities" ? search.tab : "posts";
  const query = results.query;

  function selectTab(next: string) {
    void navigate({ search: { q: query, tab: next } as never, resetScroll: false });
  }

  return (
    <section className="discover-page">
      <header className="x-search-page">
        <h1 className="sr-only">Ara</h1>
        <SearchForm initial={search.q || ""} />
      </header>
      {query ? (
        <>
          <nav className="x-feed-tabs" aria-label="Arama sonuçları">
            <button type="button" className={tab === "posts" ? "active" : ""} aria-pressed={tab === "posts"} onClick={() => selectTab("posts")}>Gönderiler</button>
            <button type="button" className={tab === "people" ? "active" : ""} aria-pressed={tab === "people"} onClick={() => selectTab("people")}>Kişiler</button>
            <button type="button" className={tab === "communities" ? "active" : ""} aria-pressed={tab === "communities"} onClick={() => selectTab("communities")}>Topluluklar</button>
          </nav>
          {tab === "posts" && (results.posts.length ? <PostList posts={results.posts} hasMore={false} /> : <Empty kind="search">{`“${query}” için gönderi yok.`}</Empty>)}
          {tab === "people" && (results.people.length ? results.people.map(person => <AccountRow key={person.id} profile={person} detail={person.bio} />) : <Empty kind="search">{`“${query}” için kişi yok.`}</Empty>)}
          {tab === "communities" && (results.communities.length ? results.communities.map(community => <CommunityRow key={community.id} community={community} />) : <Empty kind="search">{`“${query}” için topluluk yok.`}</Empty>)}
        </>
      ) : (
        <>
          <section className="discover-section" aria-labelledby="discover-people-title">
            <div className="discover-section-heading">
              <h2 id="discover-people-title">Kişiler</h2>
              <span>{results.people.length} öneri</span>
            </div>
            {results.people.length ? results.people.map(person => <AccountRow key={person.id} profile={person} detail={person.bio} />) : <p className="discover-empty">Henüz başka üye yok. Yeni kişiler katıldıkça burada görünecek.</p>}
          </section>
          <section className="discover-section" aria-labelledby="discover-communities-title">
            <div className="discover-section-heading">
              <h2 id="discover-communities-title">Topluluklar</h2>
              <span>{results.communities.length} öneri</span>
            </div>
            {results.communities.length ? results.communities.map(community => <CommunityRow key={community.id} community={community} />) : <p className="discover-empty">Henüz keşfedilecek topluluk yok. İlk topluluğu oluşturup sohbeti başlatabilirsin.</p>}
          </section>
        </>
      )}
    </section>
  );
}

function CommunityRow({ community }: { community: CommunitySummary }) {
  return (
    <Link to={`/communities/${community.id}`} className="x-account-row">
      <Avatar src={community.image} name={community.name} username={community.username} />
      <span>
        <strong>{community.name}</strong>
        <small>@{community.username} · {community.memberCount} üye{community.joined ? " · Üyesin" : ""}</small>
        {community.bio && <p>{community.bio}</p>}
      </span>
    </Link>
  );
}

export function CommunitiesPage() {
  const list = useLoaderData({ strict: false }) as CommunitySummary[];

  return (
    <section>
      <header className="x-bar">
        <h1>Topluluklar</h1>
        <Link to="/communities/new" className="x-pill">Oluştur</Link>
      </header>
      {list.length ? list.map(community => <CommunityRow key={community.id} community={community} />) : <Empty description="Bir ad ve kullanıcı adıyla topluluğunu aç.">İlk topluluğu sen oluştur.</Empty>}
    </section>
  );
}

export function CreateCommunityPage() {
  const action = useAction();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let id = "";
    const success = await action.run(async () => {
      const created = await api<Community>("/communities", "POST", {
        name: form.get("name"),
        username: form.get("username"),
        bio: form.get("bio"),
      });
      id = created.id;
    });
    if (success) await navigate({ to: `/communities/${id}` });
  }

  return (
    <section>
      <header className="x-bar">
        <BackButton fallback="/communities" />
        <h1>Topluluk oluştur</h1>
        <button type="submit" form="create-community" className="x-pill" disabled={action.busy}>
          {action.busy ? "Oluşturuluyor…" : "Oluştur"}
        </button>
      </header>
      <form id="create-community" onSubmit={submit}>
        <label className="x-field">
          <span>Ad {name.length}/60</span>
          <input name="name" required minLength={3} maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Topluluğunun adı" />
        </label>
        <label className="x-field">
          <span>Kullanıcı adı</span>
          <input name="username" required pattern="[a-z0-9_]{3,30}" title="3–30 küçük harf, rakam veya alt çizgi" placeholder="ornek_topluluk" autoCapitalize="none" />
        </label>
        <label className="x-field">
          <span>Hakkında {bio.length}/350</span>
          <textarea name="bio" maxLength={350} rows={4} value={bio} onChange={event => setBio(event.target.value)} placeholder="İnsanlar burada ne hakkında konuşacak?" />
        </label>
        <ErrorNotice message={action.error} />
      </form>
    </section>
  );
}

export function CommunityPageView() {
  const data = useLoaderData({ strict: false }) as CommunityData;
  const { community } = data;
  const me = useMe();
  const action = useAction();
  const search = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const owner = community.createdBy === me.profile.id;
  const [editing, setEditing] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  async function toggleMembership() {
    await action.run(() =>
      api(
        `/communities/${community.id}/membership`,
        community.joined ? "DELETE" : "POST",
        community.joined ? undefined : {},
      ),
    );
  }

  async function updateCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bio = new FormData(event.currentTarget).get("bio");
    await action.run(() => api(`/communities/${community.id}`, "PATCH", { bio }));
  }

  function selectTab(tab: string) {
    if (tab === "posts") {
      void navigate({ search: { ...search, page: 0 } as never });
    }
  }

  return (
    <section className="x-profile">
      <header className="x-bar">
        <BackButton fallback="/communities" />
        <h1>{community.name}</h1>
      </header>
      <div className="x-cover" aria-hidden="true" />
      <div className="x-community-head">
        <div className="x-community-copy">
          <h2>{community.name}</h2>
          <p>@{community.username}</p>
          {community.bio && <p className="bio">{community.bio}</p>}
          <div className="x-member-row">
            {data.members.length > 0 && <span className="x-member-stack">{data.members.slice(0, 5).map(member => <Avatar key={member.id} src={member.image} name={member.name} username={member.username} />)}</span>}
            <span>{community.memberCount} üye</span>
          </div>
          <p className="x-joined">Kurucu <Link to={`/profile/${data.owner.id}`}>@{data.owner.username}</Link></p>
        </div>
        <div className="x-community-actions">
          {!owner && (
            <button type="button" className={community.joined ? "x-pill-outline" : "x-pill"} disabled={action.busy} onClick={toggleMembership}>
              {action.busy ? "Güncelleniyor…" : community.joined ? "Üyesin" : "Katıl"}
            </button>
          )}
          {owner && <button type="button" className="x-pill-outline" onClick={() => setEditing(open => !open)}>{editing ? "Kapat" : "Düzenle"}</button>}
        </div>
      </div>
      {editing && (
        <form className="x-field" onSubmit={updateCommunity}>
          <span>Hakkında</span>
          <textarea name="bio" defaultValue={community.bio} maxLength={350} rows={4} />
          <button type="submit" className="x-pill" disabled={action.busy}>Kaydet</button>
        </form>
      )}
      <ErrorNotice message={action.error} />
      <nav className="x-feed-tabs" aria-label="Topluluk sekmeleri">
        <button type="button" className={membersOpen ? "" : "active"} aria-pressed={!membersOpen} onClick={() => { setMembersOpen(false); selectTab("posts"); }}>Gönderiler</button>
        <button type="button" className={membersOpen ? "active" : ""} aria-pressed={membersOpen} onClick={() => setMembersOpen(true)}>Üyeler</button>
      </nav>
      {membersOpen ? (
        data.members.length ? data.members.map(member => <AccountRow key={member.id} profile={member} />) : <Empty>Henüz üye bulunmuyor.</Empty>
      ) : (
        <>
          {community.joined && <Composer communityId={community.id} />}
          <PostList posts={data.posts} hasMore={data.hasMore} />
        </>
      )}
      {membersOpen && community.memberCount > data.members.length && <p className="x-field-note">İlk {data.members.length} üye gösteriliyor.</p>}
    </section>
  );
}

export function NotificationsPage() {
  const data = useLoaderData({ strict: false }) as FeedPage;
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="x-feed-heading">
        <h1>Bildirimler</h1>
        <p className="muted">Son 24 saatte gönderilerine gelen yanıtlar.</p>
      </header>
      {data.posts.length ? (
        <PostList {...data} />
      ) : (
        <Empty>Yeni bildirim yok.</Empty>
      )}
      {!data.posts.length && <Pagination hasMore={data.hasMore} />}
    </section>
  );
}
