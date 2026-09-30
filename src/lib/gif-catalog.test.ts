import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gifMatchesQuery, sharedGifCatalog } from "./gif-catalog";

function frameCount(bytes: Buffer) {
  if (!["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())) throw new Error("Invalid GIF signature");
  let offset = 13;
  if (bytes[10] & 0x80) offset += 3 * 2 ** ((bytes[10] & 7) + 1);
  let frames = 0;
  function skipBlocks() {
    while (offset < bytes.length) {
      const size = bytes[offset++];
      if (size === 0) return;
      offset += size;
    }
    throw new Error("Truncated GIF data");
  }
  while (offset < bytes.length) {
    const block = bytes[offset++];
    if (block === 0x3b) return frames;
    if (block === 0x21) {
      offset++; // Extension label, followed by its data blocks.
      skipBlocks();
    } else if (block === 0x2c) {
      const packed = bytes[offset + 8];
      offset += 9;
      if (packed & 0x80) offset += 3 * 2 ** ((packed & 7) + 1);
      offset++; // LZW minimum code size.
      skipBlocks();
      frames++;
    } else throw new Error("Invalid GIF block");
  }
  throw new Error("Missing GIF trailer");
}

describe("shared GIF catalog", () => {
  test("every catalog item is an unmodified, locally bundled animated GIF", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../public/gifs/sources.json", import.meta.url), "utf8")) as {
      assets: { filename: string; source: string; bytes: number; sha256: string }[];
    };
    expect(sharedGifCatalog.map(item => item.url.split("/").at(-1)).sort()).toEqual(manifest.assets.map(item => item.filename).sort());
    for (const item of sharedGifCatalog) {
      expect(item.url).toMatch(/^\/gifs\/[a-z0-9-]+\.gif$/);
      const bytes = readFileSync(new URL(`../../public${item.url}`, import.meta.url));
      const source = manifest.assets.find(asset => item.url.endsWith(`/${asset.filename}`))!;
      expect(source.source).toMatch(/^https:\/\/fonts\.gstatic\.com\/s\/e\/notoemoji\/latest\/[a-f0-9_]+\/512\.gif$/);
      expect(bytes.length).toBe(source.bytes);
      expect(createHash("sha256").update(Uint8Array.from(bytes)).digest("hex")).toBe(source.sha256);
      expect(frameCount(bytes)).toBeGreaterThan(1);
    }
  });

  test("search accepts Turkish names, ASCII spelling, and English reaction tags", () => {
    const smile = sharedGifCatalog.find(item => item.url === "/gifs/smile.gif")!;
    expect(gifMatchesQuery(smile, "GÜLÜMSE")).toBe(true);
    expect(gifMatchesQuery(smile, "gulumse")).toBe(true);
    expect(gifMatchesQuery(smile, "happy")).toBe(true);
    expect(gifMatchesQuery(smile, "sad")).toBe(false);
    expect(gifMatchesQuery(sharedGifCatalog.find(item => item.url === "/gifs/heart-hands.gif")!, "heart hands")).toBe(true);
    expect(gifMatchesQuery({ name: "My upload.gif" }, "upload")).toBe(true);
  });
});
