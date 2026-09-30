import { useEffect, useState } from "react";
import { Icon } from "./icon";

const TOAST_EVENT = "social-toast";
let toastId = 0;
type Toast = { id: number; message: string };

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<Toast>(TOAST_EVENT, { detail: { id: ++toastId, message } }));
}

export function ToastViewport() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    function receive(event: Event) {
      setPaused(false);
      setToast((event as CustomEvent<Toast>).detail);
    }
    window.addEventListener(TOAST_EVENT, receive);
    return () => window.removeEventListener(TOAST_EVENT, receive);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = paused ? undefined : window.setTimeout(() => setToast(null), 4000);
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") setToast(null);
    }
    window.addEventListener("keydown", dismiss);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", dismiss);
    };
  }, [toast, paused]);

  return <div className="app-toast-region" role="status" aria-live="polite" aria-atomic="true">
    {toast && <div key={toast.id} className="app-toast" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <Icon name="check" size={18} />
      <span>{toast.message}</span>
      <button type="button" aria-label="Bildirimi kapat" onClick={() => setToast(null)}><Icon name="close" size={18} /></button>
    </div>}
  </div>;
}
