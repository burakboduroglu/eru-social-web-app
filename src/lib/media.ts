export type ParsedMediaUrl =
  | { type: "youtube"; embedUrl: string }
  | { type: "spotify"; embedUrl: string }
  | { type: "gif"; url: string }
  | { type: "post-media"; url: string; mediaType: "image" | "video" };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const VIDEO_EXTENSIONS = /\.(?:mp4|webm|mov|m4v)$/i;

function safeHttpUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function parseMediaUrl(input: string, appOrigin?: string): ParsedMediaUrl | null {
  const url = safeHttpUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const origin = appOrigin || (typeof window !== "undefined" ? window.location.origin : undefined);
  // Only the bundled starter catalog is embeddable on our own origin.
  if (origin && url.origin === origin && /^\/gifs\/[a-z0-9-]+\.gif$/.test(url.pathname) && !url.search) return { type: "gif", url: url.href };
  if (url.port) return null;

  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const id = url.pathname === "/watch"
      ? url.searchParams.get("v")
      : ["shorts", "embed", "live"].includes(segments[0] || "") ? segments[1] : null;
    if (id && YOUTUBE_ID.test(id)) return { type: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && YOUTUBE_ID.test(id)) return { type: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    return null;
  }

  if (host === "open.spotify.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const offset = segments[0] === "embed" ? 1 : 0;
    const kind = segments[offset];
    const id = segments[offset + 1];
    if (["track", "album", "playlist", "episode"].includes(kind || "") && id && SPOTIFY_ID.test(id)) {
      return { type: "spotify", embedUrl: `https://open.spotify.com/embed/${kind}/${id}` };
    }
    return null;
  }

  if (["media.tenor.com", "media.giphy.com"].includes(host) && IMAGE_EXTENSIONS.test(url.pathname)) {
    return { type: "gif", url: url.href };
  }

  if (host.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/public/post-media/")) {
    const objectPath = url.pathname.slice("/storage/v1/object/public/post-media/".length);
    if (!objectPath || objectPath.split("/").some(part => !part || part === "." || part === "..")) return null;
    if (IMAGE_EXTENSIONS.test(objectPath)) return { type: "post-media", url: url.href, mediaType: "image" };
    if (VIDEO_EXTENSIONS.test(objectPath)) return { type: "post-media", url: url.href, mediaType: "video" };
  }
  return null;
}
