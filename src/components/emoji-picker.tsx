import { useEffect, useRef, useState } from "react";

export function EmojiPicker({ onSelect }: { onSelect: (value: string) => void }) {
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  useEffect(() => {
    let active = true;
    Promise.all([import("emoji-mart"), import("@emoji-mart/data")]).then(([{ Picker }, data]) => {
      if (!active || !host.current) return;
      const picker = new Picker({ data: data.default, theme: "dark", locale: "tr", perLine: 8, navPosition: "top", previewPosition: "none", onEmojiSelect: (emoji: { native: string }) => callback.current(emoji.native) });
      if (picker instanceof HTMLElement) host.current.replaceChildren(picker);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; host.current?.replaceChildren(); };
  }, []);
  return failed ? <p role="alert">Emoji seçici yüklenemedi. Kapatıp tekrar açabilirsin.</p> : <div ref={host} className="emoji-panel" />;
}
