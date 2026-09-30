import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { parseMediaUrl } from "../lib/media";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION = /[.,!?;:)}\]]+$/;

function renderMedia(url: string, key: number): ReactNode {
  const media = parseMediaUrl(url);
  if (!media) return <a key={key} href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
  if (media.type === "youtube") return <div className="post-video" key={key} style={{ aspectRatio: "16 / 9", width: "100%" }}>
    <iframe src={media.embedUrl} title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{ width: "100%", height: "100%", border: 0 }} />
  </div>;
  if (media.type === "spotify") return <iframe key={key} src={media.embedUrl} title="Spotify player" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ width: "100%", height: 152, border: 0 }} />;
  if (media.type === "gif") return <img key={key} src={media.url} alt="GIF" loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 200, objectFit: "contain" }} />;
  if (media.mediaType === "video") return <video key={key} src={media.url} controls playsInline preload="metadata" style={{ display: "block", width: "100%", maxHeight: 420 }} />;
  return <img key={key} src={media.url} alt="Gönderi görseli" loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 420, objectFit: "contain" }} />;
}

function renderText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text))) {
    const raw = match[0];
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    if (!trimmed) continue;
    const start = match.index;
    nodes.push(text.slice(cursor, start));
    nodes.push(renderMedia(trimmed, start));
    nodes.push(raw.slice(trimmed.length));
    cursor = start + raw.length;
  }
  nodes.push(text.slice(cursor));
  return nodes;
}

export function PostContent({ text, postId, truncate = false }: { text: string; postId: string; truncate?: boolean }) {
  const isTruncated = truncate && text.length > 250;
  const visibleText = isTruncated ? `${text.slice(0, 250).replace(/\s+$/, "")}…` : text;
  return <div className="post-text text-[15px] text-white">
    {renderText(visibleText)}
    {isTruncated && <> <Link to={`/thread/${postId}`}>devamını oku</Link></>}
  </div>;
}
