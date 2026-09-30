import { useEffect, useState } from "react";
import { detectLinks, displayLink, type LinkPreviewData } from "../../shared/link-preview";
import { api } from "../lib/api";
import { parseMediaUrl } from "../lib/media";

const cache = new Map<string, { expires: number; data: LinkPreviewData | null }>();
const pending = new Map<string, Promise<LinkPreviewData | null>>();
const queue: Array<() => void> = [];
let activeRequests = 0;
function loadPreview(url: string): Promise<LinkPreviewData | null> {
  return new Promise(resolve => {
    const start = () => {
      activeRequests++;
      api<{ preview: LinkPreviewData | null }>(`/link-preview?url=${encodeURIComponent(url)}`)
        .then(result => resolve(result.preview || null), () => resolve(null))
        .finally(() => { activeRequests--; queue.shift()?.(); });
    };
    if (activeRequests < 4) start(); else queue.push(start);
  });
}
function requestPreview(url: string): Promise<LinkPreviewData | null> {
  const entry = cache.get(url);
  if (entry && entry.expires > Date.now()) return Promise.resolve(entry.data);
  const existing = pending.get(url);
  if (existing) return existing;
  if (pending.size >= 80) return Promise.resolve(null);
  const task = loadPreview(url).then(data => {
      cache.set(url, { data, expires: Date.now() + (data ? 10 * 60_000 : 60_000) });
      if (cache.size > 80) cache.delete(cache.keys().next().value!);
      return data;
    }).finally(() => pending.delete(url));
  pending.set(url, task);
  return task;
}
function useLinkPreview(url: string | null, delay: number) {
  const [result, setResult] = useState<{ url: string; data: LinkPreviewData | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const timer = setTimeout(() => { requestPreview(url).then(data => { if (active) setResult({ url, data }); }); }, delay);
    return () => { active = false; clearTimeout(timer); };
  }, [url, delay]);
  return result?.url === url ? result.data : undefined;
}
export function firstPreviewUrl(text: string): string | null {
  return detectLinks(text).find(link => !parseMediaUrl(link.url))?.url || null;
}

function PreviewCard({ preview, compact = false }: { preview: LinkPreviewData; compact?: boolean }) {
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  return <a className={`link-preview${compact ? " link-preview-compact" : ""}`} href={preview.url} target="_blank" rel="noopener noreferrer" aria-label={`${preview.title} — ${preview.hostname}`}>
    {preview.image && brokenImage !== preview.image && <img className="link-preview-image" src={preview.image} alt="" loading="lazy" onError={() => setBrokenImage(preview.image)} />}
    <div className="link-preview-copy"><span className="link-preview-site">{preview.siteName || preview.hostname.replace(/^www\./, "")}</span><strong>{preview.title}</strong>{preview.description && <p>{preview.description}</p>}</div>
  </a>;
}

export function LinkPreview({ url }: { url: string }) {
  const preview = useLinkPreview(url, 0);
  return preview ? <PreviewCard preview={preview} /> : null;
}

export function ComposerLinkPreview({ text }: { text: string }) {
  const first = detectLinks(text)[0]?.url || null;
  const media = first ? parseMediaUrl(first) : null;
  const url = media ? null : first;
  const preview = useLinkPreview(url, 450);
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => { if (dismissed !== first) setDismissed(null); }, [first, dismissed]);
  if (!first || dismissed === first) return null;
  const knownTitle = media?.type === "youtube" ? "YouTube videosu" : media?.type === "spotify" ? "Spotify bağlantısı" : "GIF ve medya";
  if (!preview && !media && preview !== undefined) return null;
  return <div className="composer-link-preview">
    <button type="button" className="link-preview-close" aria-label="Taslak bağlantı önizlemesini gizle" onClick={() => setDismissed(first)}>×</button>
    {preview ? <PreviewCard preview={preview} compact /> : media ? <a className="link-preview link-preview-compact link-preview-known" href={first} target="_blank" rel="noopener noreferrer"><div className="link-preview-copy"><span className="link-preview-site">{new URL(first).hostname}</span><strong>{knownTitle}</strong><p>{displayLink(first)}</p></div></a> : <p role="status" className="link-preview-loading">Bağlantı önizlemesi hazırlanıyor…</p>}
  </div>;
}
