import { Icon } from "./components/icon";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "./components/loading";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Link, useRouter, useSearch, useNavigate, useRouterState } from "@tanstack/react-router";
import { api } from "./lib/api";
import type { Me, Post, CommunitySummary } from "../shared/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { StatePanel } from "./components/page-state";
import { EmojiPicker } from "./components/emoji-picker";
import { PostContent } from "./components/post-content";
import { GifPicker } from "./components/gif-picker";

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "İşlem tamamlanamadı. Tekrar giriş yapmayı dene.";
export function useMe() {
  const me = useRouterState({
    select: state => {
      const match = state.matches.find(item => item.routeId === "/authenticated");
      return (match?.loaderData as { me?: Me } | undefined)?.me;
    },
  });
  if (!me) throw new Error("Profil bağlamı yok.");
  return me;
}
export { Icon } from "./components/icon";
// Accounts without an uploaded photo fall back to the first letter of their
// username rather than a shared placeholder, so lists stay distinguishable.
export function Avatar({ src, name, username, large = false }: { src?: string | null; name: string; username?: string | null; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const letter = (username || name).trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
  const className = `avatar ${large ? "large" : ""}`;
  if (!src || broken) return <span className={`${className} avatar-letter`} role="img" aria-label={name}>{letter}</span>;
  return <img className={className} src={src} alt={name} loading="lazy" onError={() => setBroken(true)} />;
}
export function ErrorNotice({ message }: { message: string }) { return message ? <p role="alert" className="error">{message}</p> : null; }
export function Empty({ children, kind = "empty", description }: { children: ReactNode; kind?: "empty" | "default" | "search" | "people" | "messages"; description?: string }) {
  const title = typeof children === "string" ? children : "Henüz içerik yok";
  const copy = description ?? (kind === "search" ? "Farklı bir isim veya kullanıcı adıyla tekrar arayabilirsin." : kind === "messages" ? "Yeni bir hareket olduğunda burada görünecek." : "İlk paylaşımı yaparak sohbeti başlatabilirsin.");
  return <StatePanel kind={kind === "search" ? "no-results" : kind === "default" ? "empty" : kind} title={title} description={copy} />;
}
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); await router.invalidate(); return true; }
    catch (e) { setError(errorMessage(e)); return false; }
    finally { setBusy(false); }
  }
  return { busy, error, run };
}
export function Pagination({ hasMore, snapshot }: { hasMore: boolean; snapshot?: string }) {
  const search = useSearch({ strict: false }) as { page?: number; tab?: string; q?: string };
  const navigate = useNavigate(); const current = search.page || 0;
  if (!current && !hasMore) return null;
  return <nav className="pagination text-light-2" aria-label="Sayfalar"><Button variant="outline" disabled={!current} onClick={() => navigate({ search: { ...search, ...(snapshot ? { snapshot } : {}), page: current - 1 } as never })}>Önceki</Button><span>{current + 1}. sayfa</span><Button variant="outline" disabled={!hasMore} onClick={() => navigate({ search: { ...search, ...(snapshot ? { snapshot } : {}), page: current + 1 } as never })}>Sonraki</Button></nav>;
}
export function Composer({ communities = [], communityId, parentId }: { communities?: CommunitySummary[]; communityId?: string; parentId?: string }) {
  const action = useAction(); const me = useMe();
  const [value, setValue] = useState(""), [picker, setPicker] = useState<"emoji" | "gif" | null>(null), [message, setMessage] = useState("");
  const [target, setTarget] = useState("");
  const targetMenu = useRef<HTMLDetailsElement>(null);
  const max = parentId ? 350 : 550;
  useEffect(() => {
    const close = (event: PointerEvent) => { if (targetMenu.current && !targetMenu.current.contains(event.target as Node)) targetMenu.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    if (await action.run(() => api("/threads", "POST", { text: value, parentId, communityId: communityId || data.get("communityId") || null }))) { setValue(""); setPicker(null); setMessage(parentId ? "Yanıt paylaşıldı." : "Gönderi başarıyla paylaşıldı."); }
  }
  if (parentId) return <form className="comment-form" onSubmit={submit}><Avatar src={me.profile.image} name={me.profile.name} username={me.profile.username} /><label className="sr-only" htmlFor={`reply-${parentId}`}>Yorum yap</label><Input id={`reply-${parentId}`} value={value} onChange={e => setValue(e.target.value)} required maxLength={max} placeholder="Yorum yap" className="no-focus border-none bg-transparent text-light-1" /><Button className="comment-form_btn" disabled={action.busy || !value.trim()}>Gönder</Button><ErrorNotice message={action.error} /></form>;
  return <form className="x-composer relative flex flex-col gap-2 items-stretch" onSubmit={submit} onKeyDown={e => { if (e.key === "Escape") setPicker(null); }}>
    {!communityId && communities.length > 0 && (
      <details ref={targetMenu} className="x-target-menu">
        <summary className="x-composer-target" aria-label="Paylaşım yeri">
          <Icon name="community" size={15} />
          <span>{target ? communities.find(c => c.id === target)?.name || "Topluluk" : "Kişisel profil"}</span>
          <Icon name="chevron" size={14} />
        </summary>
        <div className="x-target-items" role="menu" aria-label="Paylaşım yeri">
          <button type="button" role="menuitemradio" aria-checked={!target} onClick={() => { setTarget(""); if (targetMenu.current) targetMenu.current.open = false; }}>
            <Avatar src={me.profile.image} name={me.profile.name} username={me.profile.username} /><span>Kişisel profil</span>{!target && <Icon name="check" size={16} />}
          </button>
          {communities.map(c => (
            <button key={c.id} type="button" role="menuitemradio" aria-checked={target === c.id} onClick={() => { setTarget(c.id); if (targetMenu.current) targetMenu.current.open = false; }}>
              <Avatar src={c.image} name={c.name} username={c.username} /><span>{c.name}</span>{target === c.id && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      </details>
    )}
    <input type="hidden" name="communityId" value={target} />
    <div className="x-composer-head">
      <div className="x-composer-avatar"><Avatar src={me.profile.image} name={me.profile.name} username={me.profile.username} /></div>
      <label htmlFor="compose-post" className="sr-only">Gönderi paylaş</label><Textarea id="compose-post" value={value} onChange={e => { setValue(e.target.value); setMessage(""); }} placeholder="Neler oluyor?" maxLength={max} required className="no-focus max-h-[200px] resize-none border-0 bg-transparent text-[20px] text-light-1 shadow-none" />
    </div>
    <div className="flex items-center w-full justify-between"><div className="flex gap-3.5 pl-1">
      <button type="button" className="icon-button" aria-label="GIF seç" aria-expanded={picker === "gif"} onClick={() => setPicker(picker === "gif" ? null : "gif")}><Icon name="gif" /></button>
      <button type="button" className="icon-button" aria-label="Emoji seç" aria-expanded={picker === "emoji"} onClick={() => setPicker(picker === "emoji" ? null : "emoji")}><Icon name="emoji" size={22} /></button>
    </div><Button className="rounded-full px-5" disabled={action.busy || !value.trim()}>{action.busy ? "Paylaşılıyor…" : "Gönderi yayınla"}</Button></div>
    {picker && <div className="composer-picker" role="dialog" aria-label={picker === "emoji" ? "Emoji seçici" : "GIF seçici"}><button type="button" className="picker-close" aria-label="Seçiciyi kapat" onClick={() => setPicker(null)}>×</button>{picker === "emoji" ? <EmojiPicker onSelect={emoji => setValue(current => (current + emoji).slice(0, max))} /> : <GifPicker onSelect={url => { if (value.length + url.length + 1 <= max) { setValue(current => `${current}${current ? " " : ""}${url}`); setPicker(null); } else setMessage("GIF için karakter sınırında yeterli yer yok."); }} />}</div>}
    {value.length >= max && <p className="text-red-400 text-small-regular">Maksimum karakter sınırına ulaşıldı.</p>}{message && <p role="status" className="text-small-regular text-light-3 self-start">{message}</p>}<ErrorNotice message={action.error} />
  </form>;
}
function relativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "şimdi";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
function fullDate(value: string) {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function PostCard({ post, detail = false }: { post: Post; detail?: boolean }) {
  const { profile } = useMe(); const action = useAction(); const navigate = useNavigate();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const menu = useRef<HTMLDetailsElement>(null);
  const [liked, setLiked] = useState(post.liked), [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false), [dismissed, setDismissed] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { setLiked(post.liked); setLikeCount(post.likeCount); }, [post.liked, post.likeCount]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function like() {
    if (liking) return;
    const previous = { liked, likeCount };
    setLiking(true); setMessage(""); setLiked(!liked); setLikeCount(count => Math.max(0, count + (liked ? -1 : 1)));
    try { const result = await api<{ liked: boolean; count: number }>(`/threads/${post.id}/like`, "POST", {}); setLiked(result.liked); setLikeCount(Number(result.count)); }
    catch { setLiked(previous.liked); setLikeCount(previous.likeCount); setMessage("Beğeni kaydedilemedi. Tekrar dene."); }
    finally { setLiking(false); }
  }
  async function dismiss(undo = false) {
    if (menu.current) menu.current.open = false;
    setDismissed(!undo); setMessage("");
    try { await api(`/threads/${post.id}/dismiss`, undo ? "DELETE" : "POST", {}); }
    catch { setDismissed(undo); setMessage("Tercihin kaydedilemedi. Tekrar dene."); }
  }
  if (dismissed) return <div className="dismissed-post" role="status"><span>Bu gönderi akışından kaldırıldı.</span><button type="button" onClick={() => dismiss(true)}>Geri al</button></div>;
  const detailPath = `/thread/${post.id}`;
  return <article className={`x-post${detail ? " thread-main" : ""}`}>
    {pathname !== detailPath && <Link to={detailPath} className="post-detail-link" aria-label={`${post.author.name} gönderisinin detayını aç`} />}
    <Link to={`/profile/${post.author.id}`} className="post-avatar-link"><Avatar src={post.author.image} name={post.author.name} username={post.author.username} /></Link>
    <div className="post-body">
      <div className="post-heading"><div className="x-post-meta"><Link to={`/profile/${post.author.id}`} className="font-bold text-light-1">{post.author.name}</Link><span>@{post.author.username}</span><span>·</span><Link to={`/thread/${post.id}`} className="post-date"><time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString("tr-TR")}>{relativeDate(post.createdAt)}</time></Link></div>
        <details ref={menu} className="post-menu" onKeyDown={event => { if (event.key === "Escape" && menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }}>
          <summary aria-label="Gönderi seçenekleri"><Icon name="menu" size={20} /></summary>
          <div className="post-menu-items"><button type="button" onClick={async () => { if (menu.current) menu.current.open = false; try { await navigator.clipboard.writeText(`${location.origin}/thread/${post.id}`); setMessage("Bağlantı kopyalandı."); } catch { setMessage("Bağlantı kopyalanamadı."); } }}>Bağlantıyı kopyala</button>
            {post.authorId !== profile.id && <button type="button" onClick={() => dismiss()}>Bu gönderiyle ilgilenmiyorum</button>}
            {post.authorId === profile.id && <button type="button" className="text-red-400" disabled={action.busy} onClick={() => { if (menu.current) menu.current.open = false; if (confirm("Gönderi ve yanıtları silinsin mi?")) action.run(async () => { await api(`/threads/${post.id}`, "DELETE"); if (pathname === `/thread/${post.id}`) await navigate({ to: `/profile/${profile.id}` }); }); }}>Gönderiyi sil</button>}
          </div>
        </details>
      </div>
      {post.parentId && <Link className="post-context" to={`/thread/${post.parentId}`}>Yanıtlanan gönderi</Link>}
      <PostContent text={post.text} postId={post.id} truncate={pathname === "/"} />
      {post.community && <Link to={`/communities/${post.community.id}`} className="post-context">{post.community.name}</Link>}
      {detail && <div className="thread-meta"><time dateTime={post.createdAt}>{fullDate(post.createdAt)}</time></div>}
      {detail && <div className="thread-counts"><span><strong>{post.replyCount}</strong> Yanıt</span><span><strong>{likeCount}</strong> Beğeni</span></div>}
      <div className="post-actions-row">
        <Link className="post-action reply-action" to={`/thread/${post.id}`} aria-label={`${post.replyCount} yanıt`}><Icon name="reply" size={19} /><span>{post.replyCount || ""}</span></Link>
        <button className="post-action like-action" aria-label={liked ? "Beğeniyi kaldır" : "Beğen"} aria-pressed={liked} disabled={liking} onClick={like}><Icon name={liked ? "heart-filled" : "heart-gray"} size={19} /><span>{likeCount || ""}</span></button>
        <Link className="post-action" to={`/thread/share/${post.id}`} aria-label="Gönderiyi paylaş"><Icon name="share" size={19} /></Link>
      </div>
      {message && <p className="post-feedback" role="status">{message}</p>}<ErrorNotice message={action.error} />
    </div>
  </article>;
}
export function PostList({ posts, hasMore, snapshot }: { posts: Post[]; hasMore: boolean; snapshot?: string }) { const loading = useContentLoading(); const visible = useDelayedLoading(loading); if (visible) return <LoadingSpinner />; return <><div className="x-post-list">{posts.length ? posts.map(p => <PostCard key={p.id} post={p} />) : <Empty>Henüz gönderi yok.</Empty>}</div><Pagination hasMore={hasMore} snapshot={snapshot} /></>; }
