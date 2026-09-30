export type LinkPreviewData = {
  url: string;
  hostname: string;
  title: string;
  description: string;
  siteName: string;
  image: string | null;
};

export type DetectedLink = { start: number; end: number; text: string; url: string };
const LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?:[/?#][^\s<>"']*)?/gi;
const COMMON_TLDS = new Set("com org net io dev app co edu gov me tr uk de fr us ai gg tv info biz xyz social tech design cloud site online website store blog news games world space sh so cc it es nl ca au jp".split(" "));

export function normalizeHttpUrl(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function trimLink(value: string) {
  let trimmed = value.replace(/[.,!?;:]+$/, "");
  for (const [opening, closing] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (trimmed.endsWith(closing) && trimmed.split(closing).length > trimmed.split(opening).length) trimmed = trimmed.slice(0, -1);
  }
  return trimmed.replace(/[.,!?;:]+$/, "");
}

export function detectLinks(text: string): DetectedLink[] {
  const links: DetectedLink[] = [];
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index!;
    if (start > 0 && /[\p{L}\p{N}_@/:]/u.test(text[start - 1])) continue;
    const raw = trimLink(match[0]);
    const url = normalizeHttpUrl(raw);
    if (!url) continue;
    if (!/^(?:https?:\/\/|www\.)/i.test(raw)) {
      const tld = new URL(url).hostname.split(".").at(-1)!;
      if (!COMMON_TLDS.has(tld)) continue;
    }
    links.push({ start, end: start + raw.length, text: raw, url });
  }
  return links;
}

export function displayLink(value: string): string {
  try {
    const url = new URL(value);
    const path = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
    const readable = decodeURI(path);
    return readable.length > 70 ? `${readable.slice(0, 67)}…` : readable;
  } catch { return value; }
}
