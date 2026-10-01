import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { Icon } from "./icon";
import { showToast } from "./toast";
import { useFloatingPicker } from "./use-floating-picker";
import "./share-menu.css";

export function ShareMenu({ postId }: { postId: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const initialFocus = useRef<"first" | "last">("first");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const url = `${location.origin}/thread/${encodeURIComponent(postId)}`;
  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore && trigger.current?.isConnected) trigger.current.focus();
  }, []);
  useFloatingPicker(open, panel, trigger, 264);

  useEffect(() => { close(); }, [pathname, postId, close]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent | FocusEvent) {
      const target = event.target as Node | null;
      if (target && !trigger.current?.contains(target) && !panel.current?.contains(target)) close();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, [open, close]);
  useLayoutEffect(() => {
    if (!open) return;
    const items = panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    (initialFocus.current === "last" ? items?.[items.length - 1] : items?.[0])?.focus();
  }, [open]);

  function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      initialFocus.current = event.key === "ArrowUp" || event.key === "End" ? "last" : "first";
      setError(""); setOpen(true); return;
    }
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') || [])];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  }

  async function share(copy: boolean) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (copy) await navigator.clipboard.writeText(url);
      else await navigator.share({ url, title: "social-web gönderisi" });
      showToast(copy ? "Bağlantı kopyalandı." : "Paylaşım tamamlandı.");
      close(true);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") close(true);
      else setError(copy ? "Bağlantı kopyalanamadı. Aşağıdaki bağlantıyı seçip kopyalayabilirsin." : "Paylaşım açılamadı. Bağlantıyı kopyalamayı deneyebilirsin.");
    } finally { pending.current = false; setBusy(false); }
  }

  return <>
    <button ref={trigger} type="button" className="post-action share-menu-trigger" aria-label="Gönderiyi paylaş" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onKeyDown={keyDown} onClick={() => {
      if (open) close(true);
      else { initialFocus.current = "first"; setError(""); setOpen(true); }
    }}><Icon name="share" size={19} /></button>
    {open && createPortal(<div ref={panel} id={id} className="share-menu-panel" role="menu" aria-label="Gönderiyi paylaş" onKeyDown={keyDown}>
      <button type="button" role="menuitem" disabled={busy} onClick={() => void share(true)}><Icon name="copy" size={18} /><span>{busy ? "İşleniyor…" : "Bağlantıyı kopyala"}</span></button>
      {typeof navigator.share === "function" && <button type="button" role="menuitem" disabled={busy} onClick={() => void share(false)}><Icon name="share" size={18} /><span>Şununla paylaş…</span></button>}
      <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => close(true)}><Icon name="share" size={18} /><span>WhatsApp ile paylaş</span></a>
      {error && <div className="share-menu-error"><p role="alert">{error}</p><input readOnly aria-label="Gönderi bağlantısı" value={url} onFocus={event => event.currentTarget.select()} /></div>}
    </div>, document.body)}
  </>;
}
