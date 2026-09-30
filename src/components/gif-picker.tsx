import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Input } from "./ui/input";

export function GifPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [items, setItems] = useState<{ name: string; url: string }[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Tekrar giriş yapmalısın.");
    const { data, error } = await supabase.storage.from("post-media").list(user.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error("GIF arşivi yüklenemedi.");
    setItems((data || []).filter(item => item.name.endsWith(".gif")).map(item => ({ name: item.name, url: supabase.storage.from("post-media").getPublicUrl(`${user.id}/${item.name}`).data.publicUrl })));
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  return <div className="stack p-4"><h2 className="text-base-semibold">GIF seç</h2><Input aria-label="GIF arşivinde ara" placeholder="GIF arşivinde ara" value={query} onChange={e => setQuery(e.target.value)} />
    <label className="text-small-regular">GIF yükle (en fazla 5 MB)<Input type="file" accept="image/gif" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      setError(""); setBusy(true);
      try {
        if (file.type !== "image/gif" || file.size > 5 * 1024 * 1024) throw new Error("En fazla 5 MB GIF seçebilirsin.");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Tekrar giriş yapmalısın.");
        const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
        const path = `${user.id}/${crypto.randomUUID()}-${filename.toLowerCase().endsWith(".gif") ? filename : `${filename}.gif`}`;
        const { error } = await supabase.storage.from("post-media").upload(path, file, { contentType: "image/gif" });
        if (error) throw new Error("GIF yüklenemedi. Tekrar dene.");
        onSelect(supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl);
      } catch (e) { setError(e instanceof Error ? e.message : "GIF yüklenemedi."); } finally { setBusy(false); }
    }} /></label>{busy && <p role="status">Yükleniyor…</p>}{error && <p role="alert" className="error">{error}</p>}
    <div className="grid grid-cols-2 gap-2">{items.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => <button type="button" key={item.url} onClick={() => onSelect(item.url)} aria-label={`${item.name} GIF seç`}><img src={item.url} alt="" loading="lazy" className="w-full rounded-md" /></button>)}</div>
    {!items.length && <p className="text-small-regular text-light-3">Yüklediğin GIF’ler burada görünür.</p>}
  </div>;
}
