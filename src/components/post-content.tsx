import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { parseMediaUrl } from "../lib/media";
import { detectLinks, displayLink } from "../../shared/link-preview";
import { firstPreviewUrl, LinkPreview } from "./link-preview";

function renderMedia(url: string, key: number): ReactNode {
  const media = parseMediaUrl(url);
  if (!media) return <a key={key} href={url} target="_blank" rel="noopener noreferrer" title={url}>{displayLink(url)}</a>;
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
  for (const link of detectLinks(text)) {
    nodes.push(text.slice(cursor, link.start));
    nodes.push(renderMedia(link.url, link.start));
    cursor = link.end;
  }
  nodes.push(text.slice(cursor));
  return nodes;
}

export function PostContent({ text, postId, truncate = false, hasAttachments = false }: { text: string; postId: string; truncate?: boolean; hasAttachments?: boolean }) {
  const isTruncated = truncate && text.length > 250;
  const cutoff = detectLinks(text).find(link => link.start < 250 && link.end > 250)?.start ?? 250;
  const visibleText = isTruncated ? `${text.slice(0, cutoff).replace(/\s+$/, "")}…` : text;
  const previewUrl = firstPreviewUrl(visibleText);
  return <div className="post-text text-[15px] text-white">
    {renderText(visibleText)}
    {isTruncated && <> <Link to={`/thread/${postId}`}>devamını oku</Link></>}
    {previewUrl && !hasAttachments && <LinkPreview url={previewUrl} />}
  </div>;
}
