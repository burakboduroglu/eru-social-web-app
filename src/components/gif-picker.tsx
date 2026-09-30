import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Input } from "./ui/input";
import { gifMatchesQuery, sharedGifCatalog } from "../lib/gif-catalog";

type GifItem = { name: string; url: string };
function readableName(name: string) {
  return name.replace(/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}-/i, "");
}

function GifThumbnail({ item, onSelect }: { item: GifItem; onSelect: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="gif-picker-item" disabled={failed} aria-label={`${item.name} GIF seç`} title={item.name} onClick={() => onSelect(item.url)}>
    {failed ? <span className="gif-thumbnail-error">Önizleme yüklenemedi</span> : <img src={item.url} alt={item.name} loading="lazy" onError={() => setFailed(true)} />}
  </button>;
}

export function GifPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [items, setItems] = useState<GifItem[]>([]);
  const [source, setSource] = useState<"shared" | "personal">("shared");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const active = useRef(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => { active.current = true; search.current?.focus(); return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError("");
    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current) return;
      if (authError || !user) throw new Error("GIF arşivi için tekrar giriş yapmalısın.");
      const archive = supabase.storage.from("post-media");
      const gifs: GifItem[] = [];
      // Paginate all uploads so older GIFs are not hidden behind newer image uploads.
      for (let offset = 0; current; offset += 100) {
        const { data, error } = await archive.list(user.id, { limit: 100, offset, sortBy: { column: "created_at", order: "desc" } });
        if (!current) return;
        if (error) throw new Error("GIF arşivi yüklenemedi. Tekrar deneyebilirsin.");
        gifs.push(...(data || []).filter(item => /\.gif$/i.test(item.name)).map(item => ({ name: readableName(item.name), url: archive.getPublicUrl(`${user.id}/${item.name}`).data.publicUrl })));
        if (!data || data.length < 100) break;
      }
      if (current) setItems(gifs);
    }
    load().catch(error => { if (current) setLoadError(error instanceof Error ? error.message : "GIF arşivi yüklenemedi."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt]);

  const available = source === "shared" ? sharedGifCatalog : items;
  const matching = available.filter(item => gifMatchesQuery(item, query));
  function selectGif(url: string) { onSelect(new URL(url, window.location.origin).href); }
  return <div className="gif-picker-content">
    <div className="gif-picker-sources" role="group" aria-label="GIF kaynağı">
      <button type="button" className="picker-retry" aria-pressed={source === "shared"} onClick={() => setSource("shared")}>Hazır GIF’ler</button>
      <button type="button" className="picker-retry" aria-pressed={source === "personal"} onClick={() => setSource("personal")}>Yüklediklerim</button>
    </div>
    <Input ref={search} type="search" aria-label="GIF ara" placeholder="GIF ara" value={query} onChange={event => setQuery(event.target.value)} />
    <label className="gif-upload-label">GIF yükle · en fazla 5 MB<Input type="file" accept="image/gif,.gif" disabled={busy} onChange={async event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setUploadError(""); setBusy(true);
      try {
        if ((file.type !== "image/gif" && !(file.type === "" && /\.gif$/i.test(file.name))) || file.size > 5 * 1024 * 1024) throw new Error("En fazla 5 MB bir GIF seçebilirsin.");
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active.current) return;
        if (authError || !user) throw new Error("GIF yüklemek için tekrar giriş yapmalısın.");
        const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
        const path = `${user.id}/${crypto.randomUUID()}-${/\.gif$/i.test(filename) ? filename : `${filename}.gif`}`;
        const archive = supabase.storage.from("post-media");
        const { error } = await archive.upload(path, file, { contentType: "image/gif" });
        if (error) throw new Error("GIF yüklenemedi. Tekrar dene.");
        if (active.current) {
          const item = { name: filename, url: archive.getPublicUrl(path).data.publicUrl };
          setItems(current => [item, ...current]);
          onSelect(item.url);
        }
      } catch (error) { if (active.current) setUploadError(error instanceof Error ? error.message : "GIF yüklenemedi."); }
      finally { if (active.current) setBusy(false); }
    }} /></label>
    {busy && <p role="status" className="picker-state">GIF yükleniyor…</p>}
    {uploadError && <p role="alert" className="error">{uploadError}</p>}
    {source === "personal" && loading ? <p role="status" className="picker-state">GIF arşivi yükleniyor…</p>
      : source === "personal" && loadError ? <div className="picker-state"><p role="alert">{loadError}</p><button type="button" className="picker-retry" onClick={() => setAttempt(current => current + 1)}>Tekrar dene</button></div>
      : source === "personal" && items.length === 0 ? <p className="picker-state">Henüz GIF yüklemedin. İlk GIF’ini yukarıdan ekleyebilirsin.</p>
      : matching.length === 0 ? <p className="picker-state">Aramana uygun GIF bulunamadı.</p>
      : <div className="gif-picker-grid" aria-label={source === "shared" ? "Hazır GIF’ler" : "Yüklenen GIF’ler"}>{matching.map(item => <GifThumbnail key={item.url} item={item} onSelect={selectGif} />)}</div>}
    {source === "shared" && <p className="gif-picker-caption">Animasyonlar: <a href="https://googlefonts.github.io/noto-emoji-files/" target="_blank" rel="noreferrer">Google Noto Emoji</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>}
  </div>;
}
