import { useEffect, useRef, useState } from "react";

export function EmojiPicker({ onSelect }: { onSelect: (value: string) => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;

  useEffect(() => {
    let active = true;
    const container = host.current;
    let observer: MutationObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setState("loading");

    async function mount() {
      const [{ Picker, init }, data, translations] = await Promise.all([
        import("emoji-mart"), import("@emoji-mart/data"), import("@emoji-mart/data/i18n/tr.json?raw"),
      ]);
      if (!active || !container) return;
      const options = {
        data: data.default, i18n: JSON.parse(translations.default), theme: "dark", locale: "tr",
        dynamicWidth: true, emojiButtonSize: 32, emojiSize: 22, autoFocus: true,
        navPosition: "top", previewPosition: "none",
        onEmojiSelect: (emoji: { native: string }) => { if (active) callback.current(emoji.native); },
      };
      // Initialize before connecting so initialization failures reach React's error state.
      await init(options);
      if (!active) return;
      const picker = new Picker(options);
      if (!(picker instanceof HTMLElement) || !picker.shadowRoot) throw new Error("Emoji picker unavailable");
      picker.injectStyles("#root { height: 100%; min-height: 0; } .scroll { min-height: 0; overscroll-behavior: contain; }");
      observer = new MutationObserver(() => {
        if (active && picker.shadowRoot?.querySelector("#root")) {
          setState("ready");
          observer?.disconnect();
          clearTimeout(timeout);
        }
      });
      observer.observe(picker.shadowRoot, { childList: true, subtree: true });
      container.replaceChildren(picker);
      timeout = setTimeout(() => {
        if (active) { observer?.disconnect(); container.replaceChildren(); setState("error"); }
      }, 10000);
    }
    mount().catch(() => { if (active) { container?.replaceChildren(); setState("error"); } });
    return () => { active = false; observer?.disconnect(); clearTimeout(timeout); container?.replaceChildren(); };
  }, [attempt]);

  return <div className="emoji-picker-content">
    {state === "loading" && <p role="status" className="picker-state">Emojiler yükleniyor…</p>}
    {state === "error" && <div className="picker-state"><p role="alert">Emoji seçici yüklenemedi.</p><button type="button" className="picker-retry" onClick={() => setAttempt(current => current + 1)}>Tekrar dene</button></div>}
    <div ref={host} className="emoji-panel" hidden={state === "error"} aria-busy={state === "loading"} />
  </div>;
}
