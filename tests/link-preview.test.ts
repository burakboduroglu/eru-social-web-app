import { describe, expect, test } from "bun:test";
import { detectLinks, displayLink } from "../shared/link-preview";
import { createLinkPreviewService, extractLinkMetadata, isPublicAddress, pinnedTransport, validatePreviewUrl } from "../server/link-preview";
import { parseMediaUrl } from "../src/lib/media";

const publicDns = async () => [{ address: "8.8.8.8", family: 4 }];
const htmlResponse = (html: string) => ({ status: 200, contentType: "text/html; charset=utf-8", body: new TextEncoder().encode(html) });
const page = '<html><head><title>Fallback</title><meta property="og:title" content="Useful &amp; readable"><meta name="description" content="A short summary"></head></html>';

describe("shared URL detection", () => {
  test("recognizes pasted, www and common bare domains without email or filename matches", () => {
    const text = 'See (https://example.com/a_(b)). Also www.example.com/news! example.org/path, me@example.com and README.md.';
    const links = detectLinks(text);
    expect(links.map(link => link.url)).toEqual(["https://example.com/a_(b)", "https://www.example.com/news", "https://example.org/path"]);
    for (const link of links) expect(text.slice(link.start, link.end)).toBe(link.text);
    expect(displayLink("https://www.example.com/story")).toBe("example.com/story");
  });
  test("does not turn credentials or unsafe schemes into links", () => {
    expect(detectLinks("https://user:password@example.com javascript:example.com/path")).toEqual([]);
  });
  test("embeds only whitelisted starter GIFs on the actual app origin", () => {
    expect(parseMediaUrl("https://social.example.com/gifs/clap.gif", "https://social.example.com")).toEqual({ type: "gif", url: "https://social.example.com/gifs/clap.gif" });
    expect(parseMediaUrl("http://localhost:5173/gifs/clap.gif", "http://localhost:5173")).toEqual({ type: "gif", url: "http://localhost:5173/gifs/clap.gif" });
    expect(parseMediaUrl("https://media.tenor.com:8443/clap.gif", "http://localhost:5173")).toBeNull();
    expect(parseMediaUrl("https://other.example.com/gifs/clap.gif", "https://social.example.com")).toBeNull();
    expect(parseMediaUrl("https://social.example.com/api/private.gif", "https://social.example.com")).toBeNull();
    expect(parseMediaUrl("https://social.example.com/gifs/clap.gif?url=private", "https://social.example.com")).toBeNull();
  });
});

describe("preview network boundaries", () => {
  test("Bun HTTP transport actually reads pinned lookup addresses using a loopback-only fixture", async () => {
    let pinnedReads = 0;
    let requestedHost = "";
    const fixture = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) { requestedHost = request.headers.get("host") || ""; return new Response(page, { headers: { "Content-Type": "text/html" } }); } });
    try {
      // Exercise the transport directly: production rejects loopback before this layer.
      const response = await pinnedTransport(new URL(`http://localhost:${fixture.port}`), [{ get address() { pinnedReads++; return "127.0.0.1"; }, family: 4 }], AbortSignal.timeout(1000), "html");
      expect(response.status).toBe(200);
      expect(pinnedReads).toBeGreaterThan(0);
      expect(requestedHost).toBe(`localhost:${fixture.port}`);
    } finally { await fixture.stop(true); }
  });
  test("rejects private, reserved, mapped and transition addresses", () => {
    for (const address of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "100.64.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "192.0.2.3", "198.18.0.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:8.8.8.8", "::ffff:7f00:1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "2001:0::1", "3fff::1", "3ffe::1"]) expect(isPublicAddress(address)).toBe(false);
    for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"]) expect(isPublicAddress(address)).toBe(true);
  });
  test("rejects local URL forms before DNS including URL-normalized numeric hosts", () => {
    for (const value of ["file:///etc/passwd", "http://localhost", "http://internal", "http://service.local", "http://127.1", "http://2130706433", "http://0x7f000001", "http://[::ffff:127.0.0.1]", "https://user:pass@example.com", "https://example.com:8443", "https://example.com\n"]) expect(() => validatePreviewUrl(value)).toThrow();
    expect(validatePreviewUrl("https://example.com/path#section").href).toBe("https://example.com/path");
  });
  test("rejects any mixed private DNS result before transport", async () => {
    let requests = 0;
    const get = createLinkPreviewService({ resolve: async () => [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }], transport: async () => { requests++; return htmlResponse(page); } });
    expect(await get("https://example.com")).toBeNull();
    expect(requests).toBe(0);
  });
  test("passes checked addresses to transport and revalidates redirect DNS", async () => {
    const requested: string[] = [];
    const get = createLinkPreviewService({
      resolve: async host => [{ address: host === "example.org" ? "127.0.0.1" : "8.8.8.8", family: 4 }],
      transport: async (url, addresses) => { expect(addresses[0].address).toBe("8.8.8.8"); requested.push(url.href); return { status: 302, location: "https://example.org/private", contentType: "", body: new Uint8Array() }; },
    });
    expect(await get("https://example.com")).toBeNull();
    expect(requested).toEqual(["https://example.com/"]);
  });
  test("rejects local redirects and limits redirect loops", async () => {
    for (const location of ["http://169.254.169.254/latest/meta-data", "http://[::ffff:127.0.0.1]", "https://user:password@example.org"]) {
      let requests = 0;
      const get = createLinkPreviewService({ resolve: publicDns, transport: async () => { requests++; return { status: 302, location, contentType: "", body: new Uint8Array() }; } });
      expect(await get("https://example.com")).toBeNull(); expect(requests).toBe(1);
    }
    let requests = 0;
    const get = createLinkPreviewService({ resolve: publicDns, transport: async () => { requests++; return { status: 301, location: "/loop", contentType: "", body: new Uint8Array() }; } });
    expect(await get("https://example.com")).toBeNull(); expect(requests).toBe(4);
  });
  test("enforces total timeout without live DNS or transport", async () => {
    const get = createLinkPreviewService({ timeoutMs: 10, resolve: () => new Promise(() => {}), transport: async () => htmlResponse(page) });
    expect(await get("https://example.com")).toBeNull();
  });
  test("bounds concurrent unique lookups while coalescing identical requests", async () => {
    let lookups = 0;
    const get = createLinkPreviewService({ timeoutMs: 15, resolve: () => { lookups++; return new Promise(() => {}); }, transport: async () => htmlResponse(page) });
    const jobs = Array.from({ length: 6 }, (_, index) => get(`https://example.com/${index}`));
    expect(await get("https://example.com/overflow")).toBeNull();
    const duplicate = get("https://example.com/0");
    await Promise.all([...jobs, duplicate]);
    expect(lookups).toBe(6);
  });
});

describe("metadata and graceful fallback", () => {
  test("parses real HTML attributes/entities and ignores scripted fake metadata", async () => {
    const metadata = await extractLinkMetadata(`<head><script>const fake='<meta property="og:title" content="Fake">';</script><title>Fallback</title><meta CONTENT='Real &quot;title&quot; > text' PROPERTY='og:title'><meta property="og:image" content="/cover.png"><meta name="description" content="Summary"></head>`, new URL("https://example.com/path"));
    expect(metadata).toMatchObject({ title: 'Real "title" > text', description: "Summary", imageUrl: "https://example.com/cover.png" });
  });
  test("returns no card for title-less, non-HTML or oversized responses", async () => {
    expect(await extractLinkMetadata("<p>Only body text</p>", new URL("https://example.com"))).toBeNull();
    for (const response of [{ status: 200, contentType: "application/json", body: new TextEncoder().encode(page) }, { status: 200, contentType: "text/html", body: new Uint8Array(256 * 1024 + 1) }]) {
      const get = createLinkPreviewService({ resolve: publicDns, transport: async () => response });
      expect(await get("https://example.com")).toBeNull();
    }
  });
  test("fetches raster images through validated transport instead of returning external image URLs", async () => {
    const get = createLinkPreviewService({ resolve: publicDns, transport: async (_url, _addresses, _signal, kind) => kind === "html" ? htmlResponse('<meta property="og:title" content="Image card"><meta property="og:image" content="/cover.png">') : { status: 200, contentType: "image/png", body: new Uint8Array([1, 2, 3]) } });
    expect(await get("https://example.com")).toMatchObject({ title: "Image card", image: "data:image/png;base64,AQID" });
  });
  test("keeps card text when image redirects to a private destination or is SVG", async () => {
    for (const imageResponse of [{ status: 302, location: "http://127.0.0.1/private", contentType: "", body: new Uint8Array() }, { status: 200, contentType: "image/svg+xml", body: new TextEncoder().encode("<svg/>") }]) {
      const get = createLinkPreviewService({ resolve: publicDns, transport: async (_url, _addresses, _signal, kind) => kind === "html" ? htmlResponse('<title>Safe text</title><meta property="og:image" content="/image">') : imageResponse });
      expect(await get("https://example.com")).toMatchObject({ title: "Safe text", image: null });
    }
  });
  test("caches shared metadata and refreshes after expiry", async () => {
    let now = 0, requests = 0;
    const get = createLinkPreviewService({ now: () => now, resolve: publicDns, transport: async () => { requests++; return htmlResponse(page); } });
    const [first, second] = await Promise.all([get("https://example.com#one"), get("https://example.com#two")]);
    expect(first).toEqual(second); expect(requests).toBe(1);
    expect(first).toMatchObject({ title: "Useful & readable", description: "A short summary", image: null });
    await get("https://example.com"); expect(requests).toBe(1);
    now = 600001;
    await get("https://example.com"); expect(requests).toBe(2);
  });
});
