import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import type { LinkPreviewData } from "../shared/link-preview";

type Address = { address: string; family: number };
type PreviewResponse = { status: number; location?: string; contentType: string; body: Uint8Array };
type Transport = (url: URL, addresses: Address[], signal: AbortSignal, kind: "html" | "image") => Promise<PreviewResponse>;
type Dependencies = { resolve?: (hostname: string) => Promise<Address[]>; transport?: Transport; now?: () => number; timeoutMs?: number };
const HTML_LIMIT = 256 * 1024;
const IMAGE_LIMIT = 512 * 1024;
const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6 || address.includes(".")) return false;
  const [first, second] = address.split(":").map(part => parseInt(part || "0", 16));
  // Only global unicast is eligible; exclude transition, documentation and special-use networks.
  return (first & 0xe000) === 0x2000 && ![0x2002, 0x3ffe, 0x3fff].includes(first)
    && !(first === 0x2001 && (second < 0x0200 || second === 0x0db8));
}

export function validatePreviewUrl(value: string): URL {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) throw new Error("Invalid preview URL");
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port
    || hostname.endsWith(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan|onion)$/.test(hostname)
    || (!isIP(hostname) && !hostname.includes(".")) || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new Error("Non-public preview URL");
  }
  url.hash = "";
  return url;
}

export const pinnedTransport: Transport = (url, addresses, signal, kind) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new Error("Preview timeout")); return; }
  const selected = addresses[0];
  const lookup: LookupFunction = (_hostname, options, callback) => {
    // Never perform a second lookup: these addresses were checked before opening the socket.
    if (options.all) callback(null, addresses);
    else (callback as unknown as (error: null, address: string, family: number) => void)(null, selected.address, selected.family);
  };
  const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
    lookup, family: selected.family, agent: false, maxHeaderSize: 16 * 1024,
    headers: { "User-Agent": "SocialWeb-LinkPreview/1.0", Accept: kind === "html" ? "text/html,application/xhtml+xml" : "image/avif,image/webp,image/png,image/jpeg,image/gif", "Accept-Encoding": "identity" },
  }, response => {
    const status = response.statusCode || 0;
    const contentType = String(response.headers["content-type"] || "");
    const mime = contentType.split(";")[0].trim().toLowerCase();
    const location = response.headers.location;
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy(); resolve({ status, location, contentType, body: new Uint8Array() }); return;
    }
    const encoding = response.headers["content-encoding"];
    const limit = kind === "html" ? HTML_LIMIT : IMAGE_LIMIT;
    const allowedType = kind === "html" ? ["text/html", "application/xhtml+xml"].includes(mime) : RASTER_TYPES.has(mime);
    if (status < 200 || status >= 300 || !allowedType || (encoding && encoding !== "identity") || Number(response.headers["content-length"]) > limit) {
      response.destroy(); reject(new Error("Preview response unavailable")); return;
    }
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    response.on("data", chunk => {
      const buffer = new Uint8Array(chunk);
      bytes += buffer.length;
      if (bytes > limit) { response.destroy(); request.destroy(); reject(new Error("Preview response too large")); return; }
      chunks.push(buffer);
    });
    response.on("end", () => {
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      resolve({ status, contentType, body });
    });
    response.on("error", reject);
    response.on("aborted", () => reject(new Error("Preview response aborted")));
  });
  const abort = () => request.destroy(new Error("Preview timeout"));
  signal.addEventListener("abort", abort, { once: true });
  request.on("close", () => signal.removeEventListener("abort", abort));
  request.on("error", reject);
  request.end();
});

function decodeEntities(value: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (original, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] || original;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  });
}
function cleanText(value: string | undefined, limit: number): string {
  return decodeEntities((value || "").replace(/<[^>]*>/g, "")).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

export async function extractLinkMetadata(html: string, url: URL): Promise<Omit<LinkPreviewData, "image"> & { imageUrl: string | null } | null> {
  const fields = new Map<string, string>();
  let count = 0;
  let documentTitle = "";
  // Bun's HTML parser respects quoted attributes, comments and script contents.
  await new HTMLRewriter()
    .on("meta", { element(element) {
      if (++count > 256) return;
      const key = (element.getAttribute("property") || element.getAttribute("name") || "").toLowerCase();
      const content = element.getAttribute("content");
      if (content && !fields.has(key)) fields.set(key, content.slice(0, 4096));
    } })
    .on("title", { text(chunk) { if (documentTitle.length < 2000) documentTitle += chunk.text.slice(0, 2000 - documentTitle.length); } })
    .transform(new Response(html)).text();
  const title = cleanText(fields.get("og:title") || fields.get("twitter:title") || documentTitle, 180);
  const description = cleanText(fields.get("og:description") || fields.get("twitter:description") || fields.get("description"), 300);
  if (!title) return null;
  let imageUrl: string | null = null;
  const image = fields.get("og:image:secure_url") || fields.get("og:image") || fields.get("twitter:image");
  if (image) {
    try { imageUrl = validatePreviewUrl(new URL(decodeEntities(image), url).href).href; } catch { /* Invalid preview images are optional. */ }
  }
  return { url: url.href, hostname: url.hostname, title, description, siteName: cleanText(fields.get("og:site_name"), 80), imageUrl };
}

async function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new Error("Preview timeout");
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error("Preview timeout"));
    signal.addEventListener("abort", abort, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export function createLinkPreviewService(dependencies: Dependencies = {}) {
  const resolveHost = dependencies.resolve || (hostname => dnsLookup(hostname, { all: true, verbatim: true }));
  const transport = dependencies.transport || pinnedTransport;
  const now = dependencies.now || Date.now;
  const cache = new Map<string, { expires: number; preview: LinkPreviewData | null }>();
  const pending = new Map<string, Promise<LinkPreviewData | null>>();

  async function publicAddresses(url: URL, signal: AbortSignal): Promise<Address[]> {
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await abortable(resolveHost(hostname), signal);
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address) || item.family !== isIP(item.address))) throw new Error("Non-public DNS response");
    return addresses;
  }
  async function download(start: URL, signal: AbortSignal, kind: "html" | "image") {
    let url = start;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await publicAddresses(url, signal);
      const response = await abortable(transport(url, addresses, signal, kind), signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.location || redirects === 3) throw new Error("Preview redirect unavailable");
        url = validatePreviewUrl(new URL(response.location, url).href);
        continue;
      }
      const mime = response.contentType.split(";")[0].trim().toLowerCase();
      const limit = kind === "html" ? HTML_LIMIT : IMAGE_LIMIT;
      if (response.status < 200 || response.status >= 300 || response.body.byteLength > limit
        || !(kind === "html" ? ["text/html", "application/xhtml+xml"].includes(mime) : RASTER_TYPES.has(mime))) throw new Error("Preview response unavailable");
      return { url, response, mime };
    }
    throw new Error("Preview redirect unavailable");
  }
  async function load(url: URL): Promise<LinkPreviewData | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(6000, Math.max(1, dependencies.timeoutMs ?? 6000)));
    try {
      const { url: finalUrl, response } = await download(url, controller.signal, "html");
      const charset = response.contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] || "utf-8";
      let html: string;
      try { html = new TextDecoder(charset).decode(response.body); } catch { html = new TextDecoder().decode(response.body); }
      const metadata = await extractLinkMetadata(html, finalUrl);
      if (!metadata) return null;
      const { imageUrl, ...preview } = metadata;
      let image: string | null = null;
      if (imageUrl) {
        try {
          const asset = await download(validatePreviewUrl(imageUrl), controller.signal, "image");
          if (asset.response.body.byteLength) image = `data:${asset.mime};base64,${Buffer.from(asset.response.body).toString("base64")}`;
        } catch { /* Keep the readable card when an image is unavailable. */ }
      }
      return { ...preview, image };
    } catch { return null; }
    finally { clearTimeout(timeout); }
  }
  return async function getLinkPreview(value: string): Promise<LinkPreviewData | null> {
    let url: URL;
    try { url = validatePreviewUrl(value); } catch { return null; }
    const key = url.href;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) { cache.delete(key); cache.set(key, cached); return cached.preview; }
    const existing = pending.get(key);
    if (existing) return existing;
    if (pending.size >= 6) return null;
    const task = load(url).then(preview => {
      cache.set(key, { preview, expires: now() + (preview ? 10 * 60_000 : 60_000) });
      if (cache.size > 128) cache.delete(cache.keys().next().value!);
      return preview;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}

export const getLinkPreview = createLinkPreviewService();
