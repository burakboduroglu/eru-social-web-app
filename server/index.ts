import { resolve, sep } from "node:path";
import { handleApi } from "./api";
const production = process.argv.includes("--production");
const root = resolve(import.meta.dir, "../dist");
const server = Bun.serve({
  port: 3001,
  hostname: production ? "0.0.0.0" : "127.0.0.1",
  maxRequestBodySize: 16 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request);
    if (!production) return new Response("Use the Vite development server.", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    let path: string;
    try { path = resolve(root, `.${decodeURIComponent(url.pathname)}`); } catch { return new Response("Bad request", { status: 400 }); }
    if (path !== root && !path.startsWith(root + sep)) return new Response("Not found", { status: 404 });
    const file = Bun.file(path);
    if (await file.exists()) return new Response(request.method === "HEAD" ? null : file, { headers: { "Content-Type": file.type, "X-Content-Type-Options": "nosniff" } });
    if (url.pathname.includes(".")) return new Response("Not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : Bun.file(resolve(root, "index.html")), { headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" } });
  },
});
console.log(`social-web API listening on ${server.url}`);
