import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

export function AccountMenu({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  function close(restoreFocus = false) {
    if (menu.current) menu.current.open = false;
    setOpen(false);
    if (restoreFocus) menu.current?.querySelector("summary")?.focus();
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <details ref={menu} className="account-menu" onToggle={event => {
    setOpen(event.currentTarget.open);
    if (event.currentTarget.open) menu.current?.querySelector("button")?.focus();
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) close(); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (menu.current) menu.current.open = true;
      menu.current?.querySelector("button")?.focus();
    }
  }}>
    <summary aria-label="Hesap seçenekleri" aria-haspopup="menu" aria-expanded={open}><Icon name="menu" size={20} /></summary>
    <div className="account-menu-items" role="menu" aria-label="Hesap seçenekleri">
      <button type="button" role="menuitem" disabled={busy} onClick={async () => {
        setBusy(true);
        close(true);
        try { await onSignOut(); } finally { setBusy(false); }
      }}><Icon name="logout" size={18} /><span>{busy ? "Çıkış yapılıyor…" : "Çıkış yap"}</span></button>
    </div>
  </details>;
}
