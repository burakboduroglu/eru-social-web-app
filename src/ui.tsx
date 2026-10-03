import { Icon } from "./components/icon";
import { showToast } from "./components/toast";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "./components/loading";
import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useRouter, useSearch, useNavigate, useRouterState } from "@tanstack/react-router";
import { api } from "./lib/api";
import type { Me, Post, CommunitySummary, TimelineEntry } from "../shared/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { StatePanel } from "./components/page-state";
import { EmojiPicker } from "./components/emoji-picker";
import { PostContent } from "./components/post-content";
import { GifPicker } from "./components/gif-picker";
import { useFloatingPicker } from "./components/use-floating-picker";
import { ComposerLinkPreview } from "./components/link-preview";
import { PixelCharacter } from "./components/pixel-character";
import { BookmarkMenuAction } from "./components/bookmark-action";
import { useComposerDraft } from "./components/use-composer-draft";
import { MediaAttachments, PostImages } from "./components/media-attachments";
import { useImageAttachments } from "./components/use-image-attachments";
import { detectLinks } from "../shared/link-preview";
import { parseMediaUrl } from "./lib/media";
import { RepostAction, RepostAttribution } from "./components/repost-action";
import { ShareMenu } from "./components/share-menu";
import { useDurableComposerDraft, DurableDraftControls } from "./components/durable-composer-draft";
import { ComposerJobAttachment, JobReferenceCard } from "./components/job-reference";

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
// A stable character gives accounts without photos a recognizable identity.
export function Avatar({ src, name, username, large = false }: { src?: string | null; name: string; username?: string | null; large?: boolean }) {
  const [brokenSource, setBrokenSource] = useState<string | null>(null);
  const className = `avatar ${large ? "large" : ""}`;
  if (!src || brokenSource === src) return <span className={`${className} avatar-pixel`} role="img" aria-label={name}><PixelCharacter seed={username || name} size={large ? 80 : 40} /></span>;
  return <img className={className} src={src} alt={name} loading="lazy" onError={() => setBrokenSource(src)} />;
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
  const pending = useRef(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError("");
    try { await action(); void router.invalidate().catch(() => setError("İşlem tamamlandı, liste yenilenemedi. Sayfayı yenileyebilirsin.")); return true; }
    catch (e) { setError(errorMessage(e)); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  return { busy, error, run };
}
export function Pagination({ hasMore, snapshot }: { hasMore: boolean; snapshot?: string }) {
  const search = useSearch({ strict: false }) as { page?: number; tab?: string; q?: string };
  const navigate = useNavigate(); const current = search.page || 0;
  if (!current && !hasMore) return null;
  return <nav className="pagination text-light-2" aria-label="Sayfalar"><Button variant="outline" disabled={!current} onClick={() => navigate({ search: { ...search, ...(snapshot ? { snapshot } : {}), page: current - 1 } as never })}>Önceki</Button><span>{current + 1}. sayfa</span><Button variant="outline" disabled={!hasMore} onClick={() => navigate({ search: { ...search, ...(snapshot ? { snapshot } : {}), page: current + 1 } as never })}>Sonraki</Button></nav>;
}
export function Composer({ communities = [], communityId, parentId, requestedJobId }: { communities?: CommunitySummary[]; communityId?: string; parentId?: string; requestedJobId?: string }) {
  const action = useAction(); const me = useMe();
  const scope = parentId ? { kind: "reply" as const, threadId: parentId } : communityId ? { kind: "community" as const, communityId } : { kind: "root" as const };
  const images = useImageAttachments(me.profile.id, parentId ? `reply:${parentId}` : communityId ? `community:${communityId}` : "root");
  const { value, setValue, target, setTarget, clearDraft, jobAttachment, setJobAttachment } = useComposerDraft(me.profile.id, scope, { hasAttachments: images.items.length > 0, onDiscard: () => { void images.discard(); } });
  const durableDraft = useDurableComposerDraft(me.profile.id, scope, value, target, jobAttachment);
  const [jobReady, setJobReady] = useState<{ key: string; ready: boolean } | null>(null);
  const attachmentKey = jobAttachment?.jobId || "deleted";
  const jobBlocked = !!jobAttachment && !(jobReady?.key === attachmentKey && jobReady.ready);
  const composerBusy = action.busy || durableDraft.busy;
  const imageInput = useRef<HTMLInputElement>(null);
  const hasGif = detectLinks(value).some(link => parseMediaUrl(link.url)?.type === "gif");
  const canPublish = !jobBlocked && images.canPublishImages && !(hasGif && images.items.length) && (!!value.trim() || images.readyMedia.length > 0);
  const [picker, setPicker] = useState<"emoji" | "gif" | null>(null), [message, setMessage] = useState("");
  const pickerId = useId();
  const pickerPanel = useRef<HTMLDivElement>(null);
  const pickerControls = useRef<HTMLDivElement>(null);
  const emojiTrigger = useRef<HTMLButtonElement>(null);
  const gifTrigger = useRef<HTMLButtonElement>(null);
  useFloatingPicker(!!picker, pickerPanel, picker === "emoji" ? emojiTrigger : gifTrigger);
  function closePicker(restoreFocus = true) {
    setPicker(null);
    if (restoreFocus) (picker === "emoji" ? emojiTrigger : gifTrigger).current?.focus({ preventScroll: true });
  }
  function togglePicker(next: "emoji" | "gif") {
    if (picker === next) { closePicker(); return; }
    window.dispatchEvent(new CustomEvent("composer-picker-open", { detail: pickerId }));
    if (targetMenu.current) targetMenu.current.open = false;
    setTargetOpen(false);
    setPicker(next);
  }
  const invalidTarget = !communityId && !!target && !communities.some(community => community.id === target);
  const [targetQuery, setTargetQuery] = useState("");
  const [targetOpen, setTargetOpen] = useState(false);
  const targetMenu = useRef<HTMLDetailsElement>(null);
  const targetSearch = useRef<HTMLInputElement>(null);
  const max = parentId ? 350 : 550;
  useEffect(() => {
    if (!picker) return;
    const outside = (event: PointerEvent) => {
      const path = event.composedPath();
      if (!path.includes(pickerPanel.current as EventTarget) && !path.includes(pickerControls.current as EventTarget)) closePicker();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closePicker(); } };
    const otherPicker = (event: Event) => { if ((event as CustomEvent<string>).detail !== pickerId) closePicker(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("composer-picker-open", otherPicker);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); window.removeEventListener("composer-picker-open", otherPicker); };
  }, [picker, pickerId]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (targetMenu.current && !targetMenu.current.contains(event.target as Node)) { targetMenu.current.open = false; setTargetOpen(false); setTargetQuery(""); } };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidTarget || composerBusy || !canPublish) return;
    closePicker(false);
    if (targetMenu.current) targetMenu.current.open = false;
    if (await action.run(() => api("/threads", "POST", { text: value, media: images.readyMedia, parentId, communityId: communityId || target || null, ...(jobAttachment ? { resourceKind: "job", jobId: jobAttachment.jobId } : {}), ...durableDraft.publishReference() }))) { durableDraft.published(); images.clearAfterPublish(); clearDraft(); setMessage(""); showToast(parentId ? "Yanıt paylaşıldı." : "Gönderi paylaşıldı."); }
  }
  if (parentId) return <form className="thread-reply-form" onSubmit={submit}>
    <Avatar src={me.profile.image} name={me.profile.name} username={me.profile.username} />
    <label className="sr-only" htmlFor={`reply-${parentId}`}>Yanıtını yaz</label>
    <Textarea id={`reply-${parentId}`} value={value} disabled={composerBusy} onChange={e => { setValue(e.target.value); setMessage(""); }} required={!images.items.length} maxLength={max} rows={2} placeholder="Yanıtını yaz" className="no-focus border-none bg-transparent text-light-1" />
    {!images.items.length && <ComposerLinkPreview text={value} />}
    {!!images.items.length && <MediaAttachments items={images.items} disabled={composerBusy || hasGif} onChange={images.setItems} onSelectFiles={images.selectFiles} onRetry={images.retry} />}
    {images.selectionError && <p className="media-selection-error" role="alert">{images.selectionError}</p>}
    {hasGif && !!images.items.length && <p className="media-selection-error" role="alert">GIF ile görsel aynı yanıtta paylaşılamaz. GIF bağlantısını veya görselleri kaldır.</p>}
    <input ref={imageInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple tabIndex={-1} aria-label="Yanıt için görsel seç" disabled={composerBusy || hasGif || images.items.length >= 4} onChange={event => { images.selectFiles([...event.currentTarget.files ?? []]); event.currentTarget.value = ""; }} />
    <div className="thread-reply-controls">
      <button type="button" className="icon-button thread-reply-media" disabled={composerBusy || hasGif || images.items.length >= 4} onClick={() => imageInput.current?.click()}><Icon name="camera" size={18} /><span>Görsel ekle</span></button>
      {value.length > max - 50 && <span className="thread-reply-length" aria-label={`${value.length} / ${max} karakter`}>{value.length}/{max}</span>}
      <Button className="thread-reply-submit" disabled={composerBusy || !canPublish}>{action.busy ? "Paylaşılıyor…" : "Yanıtla"}</Button>
    </div>
    <DurableDraftControls draft={durableDraft} disabled={composerBusy || invalidTarget || !value.trim()} hasImages={images.items.length > 0} /><ErrorNotice message={action.error} />
  </form>;
  return <form className="x-composer relative flex flex-col gap-2 items-stretch" onSubmit={submit}>
    {!communityId && communities.length > 0 && (
      <details ref={targetMenu} className="x-target-menu" onToggle={event => {
        const opened = event.currentTarget.open;
        setTargetOpen(opened); setTargetQuery("");
        if (opened && document.activeElement === event.currentTarget.querySelector("summary")) targetSearch.current?.focus();
      }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); if (targetMenu.current) targetMenu.current.open = false; setTargetOpen(false); setTargetQuery(""); targetMenu.current?.querySelector("summary")?.focus(); }
        const search = event.target instanceof HTMLInputElement;
        const items = [...(targetMenu.current?.querySelectorAll<HTMLButtonElement>(".x-target-items button:not(:disabled)") ?? [])];
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && (search || event.target === targetMenu.current?.querySelector("summary"))) {
          event.preventDefault();
          if (targetMenu.current && !targetMenu.current.open) targetMenu.current.open = true;
          (event.key === "ArrowDown" ? items[0] : items.at(-1))?.focus();
          return;
        }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) {
          event.preventDefault(); const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
          items[next]?.focus();
        } else if (!search && (event.key === "Home" || event.key === "End") && items.length) {
          event.preventDefault(); (event.key === "Home" ? items[0] : items.at(-1))?.focus();
        }
      }}>
        <summary className="x-composer-target" aria-label="Paylaşım yeri" aria-haspopup="menu" aria-expanded={targetOpen} aria-disabled={composerBusy} onClick={event => { if (composerBusy) event.preventDefault(); }}>
          <Icon name="community" size={15} />
          <span>{target ? communities.find(c => c.id === target)?.name || "Topluluk" : "Kişisel profil"}</span>
          <Icon name="chevron" size={14} />
        </summary>
        <div className="x-target-items" role="menu" aria-label="Paylaşım yeri">
          {communities.length > 5 && <label className="menu-search"><Icon name="search" size={16} /><input ref={targetSearch} type="search" aria-label="Topluluk ara" placeholder="Topluluk ara" value={targetQuery} onChange={event => setTargetQuery(event.target.value)} /></label>}
          <div className="menu-section-label">Paylaşım yeri</div>
          <button type="button" role="menuitemradio" aria-checked={!target} onClick={() => { setTarget(""); if (targetMenu.current) targetMenu.current.open = false; setTargetOpen(false); setTargetQuery(""); targetMenu.current?.querySelector("summary")?.focus(); }}>
            <Avatar src={me.profile.image} name={me.profile.name} username={me.profile.username} /><span>Kişisel profil</span>{!target && <Icon name="check" size={16} />}
          </button>
          {communities.filter(c => c.name.toLocaleLowerCase("tr-TR").includes(targetQuery.trim().toLocaleLowerCase("tr-TR"))).map(c => (
            <button key={c.id} type="button" role="menuitemradio" aria-checked={target === c.id} onClick={() => { setTarget(c.id); if (targetMenu.current) targetMenu.current.open = false; setTargetOpen(false); setTargetQuery(""); targetMenu.current?.querySelector("summary")?.focus(); }}>
              <Avatar src={c.image} name={c.name} username={c.username} /><span>{c.name}</span>{target === c.id && <Icon name="check" size={16} />}
            </button>
          ))}
          {communities.filter(c => c.name.toLocaleLowerCase("tr-TR").includes(targetQuery.trim().toLocaleLowerCase("tr-TR"))).length === 0 && <p className="menu-empty">Topluluk bulunamadı.</p>}
        </div>
      </details>
    )}
    <input type="hidden" name="communityId" value={target} />
    <div className="x-composer-head">
      <div className="x-composer-avatar"><Avatar src={me.profile.image} name={me.profile.name} username={me.profile.username} /></div>
      <label htmlFor="compose-post" className="sr-only">Gönderi paylaş</label><Textarea id="compose-post" value={value} disabled={composerBusy} onChange={e => { setValue(e.target.value); setMessage(""); }} placeholder="Neler oluyor?" maxLength={max} required={!images.items.length} className="no-focus max-h-[200px] resize-none border-0 bg-transparent text-[20px] text-light-1 shadow-none" />
    </div>
    <ComposerJobAttachment accountId={me.profile.id} attachment={jobAttachment} requestedJobId={communityId ? undefined : requestedJobId} disabled={composerBusy} hasText={!!value.trim()} onChange={setJobAttachment} onSeedText={() => { if (!value.trim()) setValue("Bu ilana göz atın."); }} onReady={(key, ready) => setJobReady(current => current?.key === key && current.ready === ready ? current : { key, ready })} />
    {!images.items.length && <ComposerLinkPreview text={value} />}
    {!!images.items.length && <MediaAttachments items={images.items} disabled={composerBusy} onChange={images.setItems} onSelectFiles={images.selectFiles} onRetry={images.retry} />}
    {images.selectionError && <p className="media-selection-error" role="alert">{images.selectionError}</p>}
    {hasGif && !!images.items.length && <p className="media-selection-error" role="alert">GIF ile görsel aynı gönderide paylaşılamaz. GIF bağlantısını veya görselleri kaldır.</p>}
    <input ref={imageInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple tabIndex={-1} aria-label="Gönderi için görsel seç" disabled={composerBusy || hasGif || images.items.length >= 4} onChange={event => { images.selectFiles([...event.currentTarget.files ?? []]); event.currentTarget.value = ""; }} />
    <div className="flex items-center w-full justify-between"><div ref={pickerControls} className="flex gap-3.5 pl-1">
      <button type="button" className="icon-button" disabled={composerBusy || hasGif || images.items.length >= 4} aria-label="Görsel ekle" onClick={() => imageInput.current?.click()}><Icon name="camera" /></button>
      <button ref={gifTrigger} type="button" className="icon-button" disabled={composerBusy || images.items.length > 0} aria-label="GIF seç" aria-haspopup="dialog" aria-controls={picker === "gif" ? pickerId : undefined} aria-expanded={picker === "gif"} onClick={() => togglePicker("gif")}><Icon name="gif" /></button>
      <button ref={emojiTrigger} type="button" className="icon-button" disabled={composerBusy} aria-label="Emoji seç" aria-haspopup="dialog" aria-controls={picker === "emoji" ? pickerId : undefined} aria-expanded={picker === "emoji"} onClick={() => togglePicker("emoji")}><Icon name="emoji" size={22} /></button>
    </div><Button className="composer-submit rounded-full px-5" disabled={composerBusy || invalidTarget || !canPublish}>{action.busy ? "Paylaşılıyor…" : "Gönderi yayınla"}</Button></div>
    {invalidTarget && <p className="post-feedback" role="alert">Seçtiğin topluluk artık kullanılamıyor. <button type="button" onClick={() => setTarget("")}>Kişisel profile geç</button></p>}
    {picker && createPortal(<div ref={pickerPanel} id={pickerId} className="composer-picker composer-picker-floating" role="dialog" aria-labelledby={`${pickerId}-title`}><div className="composer-picker-header"><h2 id={`${pickerId}-title`}>{picker === "emoji" ? "Emoji seç" : "GIF seç"}</h2><button type="button" className="picker-close" aria-label="Seçiciyi kapat" onClick={() => closePicker()}>×</button></div>{picker === "emoji" ? <EmojiPicker onSelect={emoji => { setValue(current => (current + emoji).slice(0, max)); setMessage(""); }} /> : <GifPicker onSelect={url => { if (value.length + url.length + (value ? 1 : 0) <= max) { setValue(current => `${current}${current ? " " : ""}${url}`); setMessage(""); closePicker(); } else setMessage("GIF için karakter sınırında yeterli yer yok."); }} />}</div>, document.body)}
    {value.length >= max && <p className="text-red-400 text-small-regular">Maksimum karakter sınırına ulaşıldı.</p>}{message && <p role="status" className="text-small-regular text-light-3 self-start">{message}</p>}<DurableDraftControls draft={durableDraft} disabled={composerBusy || invalidTarget || !value.trim()} hasImages={images.items.length > 0} /><ErrorNotice message={action.error} />
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
export function PostCard({ post, detail = false, repostActor }: { post: Post; detail?: boolean; repostActor?: NonNullable<TimelineEntry["repost"]>["actor"] }) {
  const { profile, communities } = useMe(); const action = useAction(); const navigate = useNavigate();
  const canRepost = !post.communityId || communities.some(community => community.id === post.communityId);
  const pathname = useRouterState({ select: state => state.location.pathname });
  const menu = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [liked, setLiked] = useState(post.liked), [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false), [dismissed, setDismissed] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { setLiked(post.liked); setLikeCount(post.likeCount); }, [post.liked, post.likeCount]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) { menu.current.open = false; setMenuOpen(false); } };
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
  return <article className={`x-post${detail ? " thread-main" : ""}${post.community ? " post-has-community" : ""}${repostActor ? " post-has-repost" : ""}`}>
    {pathname !== detailPath && <Link to={detailPath} className="post-detail-link" aria-label={`${post.author.name} gönderisinin detayını aç`} />}
    {repostActor && <RepostAttribution actor={repostActor} />}
    <Link to={`/profile/${post.author.id}`} className="post-avatar-link"><Avatar src={post.author.image} name={post.author.name} username={post.author.username} /></Link>
    <div className="post-body">
      {post.community && <Link to={`/communities/${post.community.id}`} className="post-community"><Icon name="community" size={16} /><span>{post.community.name}</span></Link>}
      <div className="post-heading"><div className="x-post-meta"><Link to={`/profile/${post.author.id}`} className="font-bold text-light-1">{post.author.name}</Link><span>@{post.author.username}</span>{!detail && <><span>·</span><Link to={`/thread/${post.id}`} className="post-date"><time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString("tr-TR")}>{relativeDate(post.createdAt)}</time></Link></>}</div>
        <details ref={menu} className="post-menu" onToggle={event => {
          const opened = event.currentTarget.open;
          setMenuOpen(opened);
          if (opened && document.activeElement === event.currentTarget.querySelector("summary")) event.currentTarget.querySelector<HTMLButtonElement>(".post-menu-items button:not(:disabled)")?.focus();
        }} onKeyDown={event => {
          if (event.key === "Escape" && menu.current) { event.preventDefault(); menu.current.open = false; setMenuOpen(false); menu.current.querySelector("summary")?.focus(); }
          const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>(".post-menu-items button:not(:disabled)") ?? [])];
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && (event.target === menu.current?.querySelector("summary") || !menu.current?.open)) {
            event.preventDefault(); if (menu.current) menu.current.open = true;
            (event.key === "ArrowDown" ? items[0] : items.at(-1))?.focus(); return;
          }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) { event.preventDefault(); const index = items.indexOf(document.activeElement as HTMLButtonElement); const next = index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length; items[next]?.focus(); }
          else if ((event.key === "Home" || event.key === "End") && items.length) { event.preventDefault(); (event.key === "Home" ? items[0] : items.at(-1))?.focus(); }
        }}>
          <summary aria-label="Gönderi seçenekleri" aria-haspopup="menu" aria-expanded={menuOpen}><Icon name="menu" size={20} /></summary>
          <div className="post-menu-items" role="menu" aria-label="Gönderi seçenekleri"><div className="menu-section-label">Gönderi seçenekleri</div><button type="button" role="menuitem" onClick={async () => { if (menu.current) menu.current.open = false; setMenuOpen(false); setMessage(""); try { await navigator.clipboard.writeText(`${location.origin}/thread/${post.id}`); showToast("Bağlantı kopyalandı."); } catch { setMessage("Bağlantı kopyalanamadı."); } }}><Icon name="copy" size={18} />Bağlantıyı kopyala</button>
            <BookmarkMenuAction postId={post.id} bookmarked={post.bookmarked} serverSource={post} onClose={() => { if (menu.current) menu.current.open = false; setMenuOpen(false); menu.current?.querySelector("summary")?.focus(); }} />
            {post.authorId !== profile.id && <button type="button" role="menuitem" onClick={() => dismiss()}><Icon name="hide" size={18} />Bu gönderiyle ilgilenmiyorum</button>}
            {post.authorId === profile.id && <button type="button" role="menuitem" className="menu-danger" disabled={action.busy} onClick={() => { if (menu.current) menu.current.open = false; setMenuOpen(false); if (confirm("Gönderi ve yanıtları silinsin mi?")) action.run(async () => { await api(`/threads/${post.id}`, "DELETE"); if (pathname === `/thread/${post.id}`) await navigate({ to: `/profile/${profile.id}` }); }); }}><Icon name="delete" size={18} />Gönderiyi sil</button>}
          </div>
        </details>
      </div>
      {post.parentId && <Link className="post-context" to={`/thread/${post.parentId}`}>Yanıtlanan gönderi</Link>}
      <PostContent text={post.text} postId={post.id} truncate={pathname === "/"} hasAttachments={!!post.media?.length} />
      <JobReferenceCard reference={post.jobReference} />
      {!!post.media?.length && <PostImages images={post.media} />}
      {detail && <div className="thread-meta"><time dateTime={post.createdAt}>{fullDate(post.createdAt)}</time></div>}
      <div className="post-actions-row">
        {detail ? <button type="button" className="post-action reply-action" aria-label={`${post.replyCount} yanıt, yanıt yaz`} onClick={() => {
          document.getElementById("thread-reply")?.scrollIntoView({ block: "center" });
          document.querySelector<HTMLTextAreaElement>("#thread-reply textarea")?.focus({ preventScroll: true });
        }}><Icon name="reply" size={19} /><span>{post.replyCount}</span></button> : <Link className="post-action reply-action" to={`/thread/${post.id}`} aria-label={`${post.replyCount} yanıt`}><Icon name="reply" size={19} /><span>{post.replyCount || ""}</span></Link>}
        <button className="post-action like-action" aria-label={liked ? "Beğeniyi kaldır" : "Beğen"} aria-pressed={liked} disabled={liking} onClick={like}><Icon name={liked ? "heart-filled" : "heart-gray"} size={19} /><span>{detail ? likeCount : likeCount || ""}</span></button>
        {!post.parentId && (canRepost || post.reposted) && <RepostAction postId={post.id} reposted={post.reposted} repostCount={post.repostCount} serverSource={post} canRepost={canRepost} compact />}
        <ShareMenu postId={post.id} />
      </div>
      {message && <p className="post-feedback" role="status">{message}</p>}<ErrorNotice message={action.error} />
    </div>
  </article>;
}
export function PostList({ posts, hasMore, snapshot }: { posts: Post[]; hasMore: boolean; snapshot?: string }) { const loading = useContentLoading(); const visible = useDelayedLoading(loading); if (visible) return <LoadingSpinner />; return <><div className="x-post-list">{posts.length ? posts.map(p => <PostCard key={p.id} post={p} />) : <Empty>Henüz gönderi yok.</Empty>}</div><Pagination hasMore={hasMore} snapshot={snapshot} /></>; }
